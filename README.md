# Splash
Real-time fluid simulation with a white splash🌊 implemented in WebGPU. 

Works on your browsers which support WebGPU (Chrome, Edge etc. Safari is also supported when WebGPU feature flag is enabled).

[Try Demo Here!](https://splash-fluid.netlify.app/)

![スクリーンショット 2025-02-22 212513](https://github.com/user-attachments/assets/aa489ca7-b54a-4166-aeb0-7716e6d62e72)
## On splash generation algorithm
In my understanding, the most well-known method for splash generation is the one presented in the paper [Unified Spray, Foam and Bubbles for Particle-Based Fluids](https://cg.informatik.uni-freiburg.de/publications/2012_CGI_sprayFoamBubbles.pdf) by Markus et al. in 2012. This method actually generates a very high-quality and physically accurate splash. However, I thought this method is a bit expensive for real-time fluid simulations for some reasons like below.
- Requires neighborhood search
- A lot of diffuse particles should be spawned

Therefore, I had to find more cheaper way to generate a white splash.
## How to run
```
npm install
npm run serve
```
If you have trouble running the repo, feel free to open an issue.
