/**
 * @name Spectrogram
 * @description <p>Plots the peak frequencies in live audio input as a spectrogram.</p>
 * <p><em><span class="small"> To run this example locally, you will need the
 * <a href="http://p5js.org/reference/#/libraries/p5.sound">p5.sound library</a>
 * and a running <a href="https://github.com/processing/p5.js/wiki/Local-server">local server</a>.</span></em></p>
 */
 
 var cutoff = 15;         // a filter on peak detection, smaller = more peaks, bigger = fewer 
var numFreqs = 20;       // number of peak frequencies to store (after sorting by amplitude)
var speed = 2;           // sideways scroll speed
var zoom = 5;            // e.g. if 5, we display the bottom fifth of frequencies
var energyThreshold = 0; // can add an optional cutoff on energy (filter out background noise)

var mic, fft;
var repeat = true;

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

function draw()
{

  // press any key to pause the output
  if(repeat){

    // reset screen when data fills the screen    
    if(frameCount%(width/speed)==0){
      background(255);
      samples = [];
    }

    var peaks = findPeaks();
    samples.push(peaks);
    
    for(var i=0; i<peaks.length; i++){
      var freq = peaks[i].freq;
      var energy = peaks[i].energy;
      fill(255-energy);
      ellipse(speed*frameCount%width, map(freq,0,22050/zoom,height,0),2,2);
    }

  }
  else {
    var peaks = samples[playbackIndex];
    resynthesize(peaks);
    playbackIndex = (playbackIndex + 1) % samples.length;
  }
}

function keyPressed(){
  repeat = !repeat;
  for(var i = 0; i < sinOscPool.length; i++){
    sinOscPool[i].stop();
  }
}
//

function findPeaks() {
  var peaks = [];
  //background(200);

  var spectrum = fft.analyze();
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
        
        if(peakEnergy>energyThreshold){
          peaks.push({
            freq: freq * (nyquist / spectrum.length),
            energy: peakEnergy
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
    osc.amp(Math.min(energy / 255, 1.0));
    if (!osc.started)
      osc.start();
  }
  for(var i = peaks.length; i < sinOscPool.length; i++){
    sinOscPool[i].stop();
  }
}
