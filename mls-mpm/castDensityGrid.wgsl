@group(0) @binding(0) var<storage, read> densityGrid: array<i32>;
@group(0) @binding(1) var<storage, read_write> castedDensityGrid: array<u32>;

override fixedPointMultiplierInverse: f32; 

fn decodeFixedPoint(fixedPoint: i32) -> f32 {
	return f32(fixedPoint) * fixedPointMultiplierInverse;
}

@compute @workgroup_size(64)
fn clearDensityGrid(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < arrayLength(&castedDensityGrid)) {
        let d0: f32 = decodeFixedPoint(densityGrid[2 * id.x]);
        let d1: f32 = decodeFixedPoint(densityGrid[2 * id.x + 1]);
        // let d01: u32 = pack2x16float(vec2f(1., 1.));
        // let d01: u32 = pack2x16float(vec2f(0., 0.));
        let d01: u32 = pack2x16float(vec2f(d0, d1));
        castedDensityGrid[id.x] = d01;
    }
}