struct Particle {
    position: vec3f, 
    v: vec3f, 
    C: mat3x3f, 
}

struct PosVel {
    position: vec3f, 
    v: vec3f, 
    density: f32, 
    lifetime: i32, 
    splash: f32, 
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> posvel: array<PosVel>;
@group(0) @binding(2) var<uniform> numParticles: u32;
@group(0) @binding(3) var<storage, read> densities: array<f32>;

override restDensity: f32;

fn updateSplash(instance_index: u32) -> f32 {
    var splash_cand = sqrt(dot(particles[instance_index].v, particles[instance_index].v));
    splash_cand /= densities[instance_index] / restDensity;

    let lifetime_thresh = 4.;
    let lifetime = 0;
    if (splash_cand > lifetime_thresh) { // ライフタイムの付与
        posvel[instance_index].lifetime = lifetime;
    } 

    let splash_thresh = 2.;
    let splash_decrease_rate = 0.003;
    // let splash_decrease_rate = 0.1;

    // ライフタイムがある場合 ⇒ 1.0 のまま
    // if (posvel[instance_index].lifetime > 0)  {
    //     posvel[instance_index].lifetime -= 1;
    //     return 1.0;
    // } else { // ライフタイムがもうない場合 ⇒ splash を徐々に減らしていく
        var splash: f32 = posvel[instance_index].splash;
        splash = max(max(splash - splash_decrease_rate, 0.), smoothstep(splash_thresh, lifetime_thresh, splash_cand));
        posvel[instance_index].splash = splash;
        return splash;
    // }
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