/**
 * @name Frequency PeakFinder
 * @description <p>Finds the peaks in the frequency spectrum of live audio input.</p>
 * <p><em><span class="small"> To run this example locally, you will need the
 * <a href="http://p5js.org/reference/#/libraries/p5.sound">p5.sound library</a>
 * and a running <a href="https://github.com/processing/p5.js/wiki/Local-server">local server</a>.</span></em></p>
 */
 
var mic, fft;
var repeat = true;

function setup() {
   createCanvas(710,400);
   noFill();

   mic = new p5.AudioIn();
   mic.start();
   fft = new p5.FFT();
   fft.setInput(mic);
}

var cutoff = 15;
var factor = 5;
var nyquist = 22050;
var peaks = [];

function draw() {
  
  // click on the screen to pause the output
  if(repeat){

    peaks = [];
    background(200);
    
    var spectrum = fft.analyze();

    strokeWeight(2);

    beginShape();
    for (i = 1; i<spectrum.length; i++) 
    {
      vertex(i*factor, map(spectrum[i], 0, 255, height, height/2) );
      //undo comment to see peaks detected by a simpler peakfinding algorithm    
      /* 
      if(spectrum[i]>spectrum[i-1] && spectrum[i]>spectrum[i+1]){
        fill('blue');
        ellipse(i*factor, map(spectrum[i], 0, 255, height, height/2),5,5)
        noFill();
      }
      */
    }
    endShape();
    
    strokeWeight(1);
    
    stroke('blue');
    line(0,height/4,width,height/4);
    
    
    // to find FFT peaks, we look for points where its derivative is zero and decreasing
    // i.e. the maxima

    stroke('red');
    beginShape();
    for (i = 1; i<spectrum.length; i++) {
    // plotting the slope (i.e. the derivative) of the FFT
    ellipse(i*factor, map(spectrum[i+1]-spectrum[i-1], -255, 255, height/2, 0), 5,5);
    vertex(i*factor, map(spectrum[i+1]-spectrum[i-1], -255, 255, height/2, 0) );
    
    var point1 = [i, spectrum[i+1]-spectrum[i-1]];
    var point2 = [(i+1), spectrum[i+2]-spectrum[i]];
    
    // we're looking for when the derivative goes from positive to negative
    if(point1[1]>=0 && point2[1]<0){
    
      // since we won't always have a data point at the zero crossing
      // we linearly interpolate to find where the derivative crosses zero
      // i.e. we connect the neighboring values of the derivative with a straight line 
      // and find where that line intersects zero
    
      var secondDerivative = (point2[1]-point1[1])/(point2[0]-point1[0]);
      // linearly interpolating to find the frequency at which derivative is zero
      var peakFrequency = point1[0]-point1[1]/secondDerivative;
    
    
      // we filter the data by looking for points where second derivative is large
      // i.e. the derivative has a steep slope
      if(secondDerivative < -1*cutoff){
        // now we find the peakEnergy
        // once again, we won't always have data exactly at the peak
        // so we linearly interpolate the nearest points on the FFT
        // i.e. draw a straight line between them, and find the energy at the peakFrequency
        var slope = spectrum[i+1]-spectrum[i];
        var peakEnergy = spectrum[i] + slope*(peakFrequency-i);
        
        fill('red');
        ellipse(peakFrequency*factor, map(peakEnergy, 0, 255, height, height/2),7,7 );
        noFill();
        peaks.push([peakFrequency * (nyquist / spectrum.length),peakEnergy]);
      }
    }
    }
    endShape();
    }
 
}

function keyPressed(){
  repeat = !repeat;
}