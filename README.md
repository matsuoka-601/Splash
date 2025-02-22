# Splash
Real-time fluid simulation with a white splash🌊 implemented in WebGPU. 

Works on your browsers which support WebGPU (Chrome, Edge etc. Safari is also supported when WebGPU feature flag is enabled).

[Try Demo Here!](https://splash-fluid.netlify.app/)

![スクリーンショット 2025-02-22 212513](https://github.com/user-attachments/assets/aa489ca7-b54a-4166-aeb0-7716e6d62e72)
## On an algorithm for white splash generation
In my understanding, the most well-known method for white splash generation is the one presented in the paper [Unified Spray, Foam and Bubbles for Particle-Based Fluids](https://cg.informatik.uni-freiburg.de/publications/2012_CGI_sprayFoamBubbles.pdf) by Markus et al. in 2012. This method actually generates a very high-quality and physically accurate white splash. However, I thought this method is a bit expensive for real-time fluid simulations on browsers for some reasons like below.
- Requires neighborhood search
- A lot of diffuse particles should be spawned

Therefore, I had to find a cheaper way to generate a plausible white splash.

The method I used for this project is to give each particle a splash value determined by 'particle speed / (normalized) density', and to make a 'splash map' according to that value which is blended to the final result. The splash value is determined by `smoothstep(lower, upper, speed / density)`, where `lower` and `upper` are determined experimentally. As a result, it is expected that fast and isolated particles will have high splash values.

There are some implementation notes like below.
- Limit the decreasing rate of the splash value
  - Just using `smoothstep(lower, upper, speed / density)` as the splash value gives a bit unnatural result because there are some white splash particles which suddenly turn into fluid particles. To avoid this problem, decrease rate of the splash value is clamped so that they don't drop suddenly. 
- Blur the splash map using Gaussian Filter
  - Blending a 'raw' splash map gives a bit powdery result. Therefore, the splash map is blurred using Gaussian Filter to get a more splashy result.
 
Currently, I'm cutting some corners in my implementation like below.
- Gaussian Filter is now used for blurring the splash map, but I should use filters like Bilateral Filter to preserve the edges.
- Splash particles behind the fluid is now simply occluded, but they should be treated as the background so that they are visible even when inside the fluid.

Of course, there would definitely be a better way for white splash generation. Let me know if you know it :)
## How to run
```
npm install
npm run serve
```
If you have trouble running the repo, feel free to open an issue.
