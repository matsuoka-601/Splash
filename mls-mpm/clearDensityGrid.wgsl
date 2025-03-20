@group(0) @binding(0) var<storage, read_write> densityGrid: array<i32>;

@compute @workgroup_size(64)
fn clearDensityGrid(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < arrayLength(&densityGrid)) {
        densityGrid[id.x] = 0;
    }
}