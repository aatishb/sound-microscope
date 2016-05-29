/**
 * @name Spectrogram
 * @description <p>Plots the peak frequencies in live audio input as a spectrogram.</p>
 * <p><em><span class="small"> To run this example locally, you will need the
 * <a href="http://p5js.org/reference/#/libraries/p5.sound">p5.sound library</a>
 * and a running <a href="https://github.com/processing/p5.js/wiki/Local-server">local server</a>.</span></em></p>
 */

var cutoff = 2;          // a filter on peak detection, smaller = more peaks, bigger = fewer
var numFreqs = 20;       // number of peak frequencies to store (after sorting by amplitude)
var speed = 2;           // sideways scroll speed
var zoom = 1;            // e.g. if 5, we display the bottom fifth of frequencies
var volumeCutoff = -100; // peaks below this decibel level won't be stored
var minFreq = 50;        // smallest frequency displayed on spectrogram (only for display, doesn't affect calculations) 

var mic, fft;
var recording = true;
var minDecibel = -100;   // minimum decibel level (best not to change)
var maxDecibel = -30;    // maximum decibel level (best not to change)

function setup() {
   createCanvas(800,600);
   noStroke();

   mic = new p5.AudioIn();
   mic.start();
   fft = new p5.FFT();
   fft.setInput(mic);
}

var nyquist = 22050;
var samples = []; // array of peak arrays
var playbackIndex = 0;
var currentFrame = 0;

function draw()
{

  // press any key to pause the output
  if(recording){

    // reset screen when data fills the screen
    if(currentFrame%(width/speed)==0){
      background(255);
      samples = [];
    }

    var peaks = findPeaks();
    samples.push(peaks);

    var prevPeaks = samples.length >= 2 ?
      samples[samples.length - 2] :
      [];
    peakMatchPartials(prevPeaks, peaks);

    // draw
    for(var i=0; i<peaks.length; i++){
      var freq = peaks[i].freq;
      var energy = peaks[i].energy;
      
      var back = peaks[i].partial.back;
      if (back) { // connect the dots of partial
        stroke(map(energy,-130,-30,255,0));
        line(speed*(currentFrame-1)%width,map(log(back.freq),log(minFreq),log(22050/zoom),height,0),
        speed*currentFrame%width,map(log(freq),log(minFreq),log(22050/zoom),height,0));
        noStroke();
      }
      else {
        fill(map(energy,-130,-30,255,0));
        //ellipse(speed*currentFrame%width, map(freq,0,22050/zoom,height,0),2,2);
        ellipse(speed*currentFrame%width, map(log(freq),log(minFreq),log(22050/zoom),height,0),2,2);
      }
    }

    // stroke(220);
    // line(speed*currentFrame%width, 0, speed*currentFrame%width, height);

    currentFrame++;
  }
  else {
    var peaks = samples[playbackIndex];
    resynthesize(peaks);
    playbackIndex = (playbackIndex + 1) % samples.length;
  }
}

function keyPressed(){
  if(!recording){   // if we just clicked to stop playback and restart recording
    background(255);
    // reset all the synthesis stuff
    samples = [];
    playbackIndex = 0;
    currentFrame = 0;
    for (var i in sinOscTable) {
      sinOscTable[i].stop();
    }
    sinOscTable = {};
  }
  recording = !recording;
}
//

function findPeaks() {
  var peaks = [];

  var spectrum = fft.analyze(1024,'db');
  // to find FFT peaks, we look for points where its derivative is zero and decreasing
  // i.e. the maxima


  for (var i = 1; i<spectrum.length; i++) {

    // calculating the slope of the FFT, i.e. the derivative
    var point1 = [i, spectrum[i+1]-spectrum[i-1]];
    var point2 = [(i+1), spectrum[i+2]-spectrum[i]];

    // look for when the derivative goes from positive to negative
    // since this occurs at the peaks of the FFT
    if(point1[1]>=0 && point2[1]<0)
    {
      // linearly interpolate to find where the derivative crosses zero
      var secondDerivative = (point2[1]-point1[1])/(point2[0]-point1[0]);
      var peakFrequency = point1[0]-point1[1]*(point2[0]-point1[0])/(point2[1]-point1[1]);

      //filter by looking for points where second derivative is large
      if(secondDerivative < -1*cutoff)
      {
        // linearly interpolate the the FFT at peakFrequency to find peakEnergy
        var slope = spectrum[i+1]-spectrum[i];
        var peakEnergy = spectrum[i] + slope*(peakFrequency-i);

        if(peakEnergy>=volumeCutoff){
          peaks.push({
            freq: peakFrequency * (nyquist / spectrum.length),
            energy: peakEnergy,
            partial: {
              back: null,
              forward: null
            }
          });
        }
      }
    }
  }

  // we sort the peaks by peakEnergy
  peaks.sort(function(a, b) {
    return b.energy - a.energy;
  });
  peaks = peaks.slice(0,numFreqs);
  return peaks;
}

//
var sinOscTable = {};
var nextPartialID = 1;
var rampTime = 0.007;

function resynthesize(peaks) {
  // play current peaks
  for(var i=0; i<peaks.length; i++){
    var freq = peaks[i].freq;
    var energy = peaks[i].energy;
    var gain = map(Math.pow(10, (energy/20)),Math.pow(10, (minDecibel/20)),Math.pow(10, (maxDecibel/20)),0,1);
    gain = Math.min(gain, 1.0);

    var partialID = peaks[i].partial.id;
    if (!sinOscTable[partialID]) {
      sinOscTable[partialID] = new p5.SinOsc(freq);
      sinOscTable[partialID].amp(gain);
    }
    else {
      var osc = sinOscTable[partialID];
      if (!peaks[i].partial.back) {
        // entering partial
        osc.freq(freq);
        osc.amp(gain);
      }
      else {
        // transition partial
        osc.freq(freq, rampTime);
        osc.amp(gain, rampTime);
      }
    }

    if (!sinOscTable[partialID].started) {
      sinOscTable[partialID].start();
    }

    if (!peaks[i].partial.forward) {
      // exiting partial
      if (sinOscTable[peaks[i].partial.id])
        sinOscTable[peaks[i].partial.id].stop();
    }
  }
}

//
var partial_midi_threshold = 1;

// Partial tracking using implementation in http://www.klingbeil.com/data/Klingbeil_Dissertation_web.pdf
// See section 2.4.2
function peakMatchPartials(prevPeaks, curPeaks) {
  for (var i = 0; i < prevPeaks.length; i++) {
    var prevPeak = prevPeaks[i];
    for (var j = 0; j < curPeaks.length; j++) {
      var curPeak = curPeaks[j];

      // calculate distance between peaks
      var dist = Math.abs(freqToMidiFloat(prevPeak.freq) - freqToMidiFloat(curPeak.freq));

      // if distance is less than threshold, it's a candidate for matching
      if (dist < partial_midi_threshold) {
      // if the current peak already has a match with a previous peak
        var existing_distance = curPeak.partial.back ?
          Math.abs(freqToMidiFloat(curPeak.partial.back.freq) - freqToMidiFloat(curPeak.freq)) :
          partial_midi_threshold;
        // we compare the new match distance to the existing one
        if (dist < existing_distance) {
          // if it's smaller, then end the previous match
          if (curPeak.partial.back) {
            curPeak.partial.back.partial.forward = null;
          }
          if (prevPeak.partial.forward) {
            prevPeak.partial.forward.partial.back = null;
          }
          // and create a new match between this peak and the one under consideration
          curPeak.partial.back = prevPeak;
          prevPeak.partial.forward = curPeak;
          curPeak.partial.id = prevPeak.partial.id;
        }
      }
    }
  }
  // assign an ID to each entering partial
  for(var i=0; i<curPeaks.length; i++){
    if (!curPeaks[i].partial.back) {
      curPeaks[i].partial.id = nextPartialID.toString();
      nextPartialID++;
    }
  }
}

function freqToMidiFloat(f) {
  var mathlog2 = Math.log(f / 440) / Math.log(2);
  var m = 12 * mathlog2 + 57;
  return m;
};
