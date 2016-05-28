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
var minDecibel = -100;   // cutoff on minimum decibel level
var maxDecibel = -30;    // cutoff on maximum decibel level

var mic, fft;
var recording = true;

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

    if (samples.length > 2) {
      var prevPeaks = samples[samples.length - 2];
      peakMatchPartials(prevPeaks, peaks);
    }

    for(var i=0; i<peaks.length; i++){
      var freq = peaks[i].freq;
      var energy = peaks[i].energy;
      
      var back = peaks[i].partial.back;
      if (back) { // connect the dots of partial
        stroke(map(energy,-130,-30,255,0));
        line(speed*(currentFrame-1)%width,map(log(back.freq),log(30),log(22050/zoom),height,0),
        speed*currentFrame%width,map(log(freq),log(30),log(22050/zoom),height,0));
        noStroke();
      }
      else {
        fill(map(energy,-130,-30,255,0));
        //ellipse(speed*currentFrame%width, map(freq,0,22050/zoom,height,0),2,2);
        ellipse(speed*currentFrame%width, map(log(freq),log(30),log(22050/zoom),height,0),2,2);
      }
    }

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
    for(var i = 0; i < sinOscPool.length; i++){
      sinOscPool[i].stop();
    }
  }
  recording = !recording;
}
//

function findPeaks() {
  var peaks = [];

  var spectrum = fft.analyze(1024,'db');
  // to find FFT peaks, we look for points where its derivative is zero and decreasing
  // i.e. the maxima


  for (i = 1; i<spectrum.length; i++) {

    // calculating the slope (i.e. the derivative) of the FFT
    var point1 = [i, spectrum[i+1]-spectrum[i-1]];
    var point2 = [(i+1), spectrum[i+2]-spectrum[i]];

    // we're looking for when the derivative goes from positive to negative
    if(point1[1]>=0 && point2[1]<0)
    {
      // since we won't always have a data point at the zero crossing
      // we linearly interpolate to find where the derivative crosses zero
      // i.e. we connect the neighboring values of the derivative with a straight line
      // and find where that line intersects zero

      var secondDerivative = (point2[1]-point1[1])/(point2[0]-point1[0]);
      // linearly interpolating to find the frequency at which derivative is zero
      var freq = point1[0]-point1[1]*(point2[0]-point1[0])/(point2[1]-point1[1]);

      // we filter the data by looking for points where second derivative is large
      // i.e. the derivative has a steep slope
      if(secondDerivative < -1*cutoff)
      {
        // now we find the peakEnergy
        // once again, we won't always have data exactly at the peak
        // so we linearly interpolate the nearest points on the FFT
        // i.e. draw a straight line between them, and find the energy at the peakFrequency
        var slope = spectrum[i+1]-spectrum[i];
        var peakEnergy = spectrum[i] + slope*(freq-i);

        if(peakEnergy>=minDecibel){
          peaks.push({
            freq: freq * (nyquist / spectrum.length),
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
var sinOscPool = [];

function resynthesize(peaks) {
  // make sure we have the right number of sin oscs
  while (sinOscPool.length < peaks.length) {
    sinOscPool.push(new p5.SinOsc());
  }
  // assign each peak to an oscillator
  for(var i=0; i<peaks.length; i++){
    var osc = sinOscPool[i];
    var freq = peaks[i].freq;
    var energy = peaks[i].energy;

    osc.freq(freq);

    var gain = map(Math.pow(10, (energy/20)),Math.pow(10, (minDecibel/20)),Math.pow(10, (maxDecibel/20)),0,1);
    osc.amp(Math.min(gain, 1.0), 0);

    if (!osc.started)
      osc.start();
  }
  for(var i = peaks.length; i < sinOscPool.length; i++){
    sinOscPool[i].stop();
  }
}

//
var partial_midi_threshold = 1;

function peakMatchPartials(prevPeaks, curPeaks) {
  for (var i = 0; i < prevPeaks.length; i++) {
    var prevPeak = prevPeaks[i];
    for (var j = 0; j < curPeaks.length; j++) {
      var curPeak = curPeaks[j];
      //
      var dist = freqToMidi(Math.abs(prevPeak.freq - curPeak.freq));
      if (dist < partial_midi_threshold) {
        var existing_distance = curPeak.partial.back ?
          freqToMidi(Math.abs(curPeak.partial.back.freq - curPeak.freq)) :
          partial_midi_threshold;
        if (dist < existing_distance) {
          if (curPeak.partial.back)
            curPeak.partial.back.forward = null;
          curPeak.partial.back = prevPeak;
          prevPeak.partial.forward = curPeak;
        }
      }
    }
  }
}
