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
var peaks = [];

function draw()
{

  // click on the screen to pause the output
  if(repeat){

    // reset screen when data fills the screen    
    if(frameCount%(width/speed)==0){
      background(255);
    }

    peaks = [];
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
            peaks.push([freq * (nyquist / spectrum.length),peakEnergy]);
          }
        }
      }
    }

    // we sort the peaks by peakEnergy
    peaks.sort(function(a, b) {
      return b[1]-a[1];
    });
    peaks = peaks.slice(0,numFreqs);
    
    for(var i=0; i<peaks.length; i++){
      var freq = peaks[i][0];
      var energy = peaks[i][1];
      fill(255-energy);
      ellipse(speed*frameCount%width, map(freq,0,22050/zoom,height,0),2,2);
    }

  }
}

function keyPressed(){
  repeat = !repeat;
}