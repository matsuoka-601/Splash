@group(0) @binding(0) var<storage, read_write> densityGrid: array<i32>;

override fixedPointMultiplier: f32; 

fn decodeFixedPoint(fixedPoint: i32) -> f32 {
	return f32(fixedPoint) / fixedPointMultiplier;
}

@compute @workgroup_size(64)
fn clearDensityGrid(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < arrayLength(&densityGrid)) {
        densityGrid[id.x] = bitcast<i32>(decodeFixedPoint(densityGrid[id.x]));
    }
}