struct Particle {
    position: vec3f, 
    v: vec3f, 
    C: mat3x3f, 
}

struct PosVel {
    position: vec3f, 
    v: vec3f, 
    density: f32, 
    splash: f32, 
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> posvel: array<PosVel>;
@group(0) @binding(2) var<uniform> numParticles: u32;
@group(0) @binding(3) var<storage, read> densities: array<f32>;

override restDensity: f32;

fn updateSplash(instance_index: u32) -> f32 {
    var splashCand = sqrt(dot(particles[instance_index].v, particles[instance_index].v));
    splashCand /= densities[instance_index] / restDensity;

    let splashUpper = 4.;
    let splashLower = 2.;
    let splashDecreaseRate = 0.003;
    // let splashDecreaseRate = 1.;

    var splash: f32 = posvel[instance_index].splash;
    splash = max(max(splash - splashDecreaseRate, 0.), smoothstep(splashLower, splashUpper, splashCand));
    posvel[instance_index].splash = splash;
    return splash;
}

@compute @workgroup_size(64)
fn copyPosition(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < numParticles) { 
        posvel[id.x].position = particles[id.x].position;
        posvel[id.x].v = particles[id.x].v;
        posvel[id.x].density = densities[id.x];
        updateSplash(id.x);
    }
}