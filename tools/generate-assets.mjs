import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VISUAL_SHAPES } from "../packs/behavior/scripts/lib/model.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resource = join(root, "packs", "resource");
const geometryPath = join(resource, "models", "entity", "buildecho.geo.json");
const renderControllerPath = join(resource, "render_controllers", "echo.render_controllers.json");
const clientEntityPath = join(resource, "entity", "echo.entity.json");
const textureDirectory = join(resource, "textures", "entity");

const shapes = [...VISUAL_SHAPES];

const faceUv = Object.fromEntries(
  ["north", "east", "south", "west", "up", "down"].map((face) => [
    face,
    { uv: [0, 0], uv_size: [16, 16] }
  ])
);

function cube(origin, size, rotation, pivot) {
  const result = { origin, size, uv: faceUv };
  if (rotation) result.rotation = rotation;
  if (pivot) result.pivot = pivot;
  return result;
}

function bone(name, cubes, parent = undefined) {
  const result = { name, pivot: [0, 0, 0], cubes };
  if (parent) result.parent = parent;
  return result;
}

function outlineCube(source) {
  const [x, y, z] = source.origin;
  const [width, height, depth] = source.size;
  const thickness = Math.min(0.75, width, height, depth);
  const xFar = x + width - thickness;
  const yFar = y + height - thickness;
  const zFar = z + depth - thickness;
  const transform = (origin, size) => cube(origin, size, source.rotation, source.pivot);
  const outlined = [];

  for (const edgeY of [y, yFar]) {
    for (const edgeZ of [z, zFar]) {
      outlined.push(transform([x, edgeY, edgeZ], [width, thickness, thickness]));
    }
  }
  for (const edgeX of [x, xFar]) {
    for (const edgeZ of [z, zFar]) {
      outlined.push(transform([edgeX, y, edgeZ], [thickness, height, thickness]));
    }
  }
  for (const edgeX of [x, xFar]) {
    for (const edgeY of [y, yFar]) {
      outlined.push(transform([edgeX, edgeY, z], [thickness, thickness, depth]));
    }
  }

  return outlined;
}

function geometry(identifier, bones, visibleBounds = [2.5, 2.5], outlined = true) {
  const renderedBones = outlined
    ? bones.map((item) => ({
        ...item,
        cubes: (item.cubes ?? []).flatMap(outlineCube)
      }))
    : bones;
  return {
    description: {
      identifier,
      texture_width: 16,
      texture_height: 16,
      visible_bounds_width: visibleBounds[0],
      visible_bounds_height: visibleBounds[1],
      visible_bounds_offset: [0, 0.75, 0]
    },
    bones: renderedBones
  };
}

function geometryForShape(shape) {
  const id = `geometry.buildecho.${shape}`;
  const base = [-8, 0, -8];
  const full = cube(base, [16, 16, 16]);
  const lower = cube(base, [16, 8, 16]);
  const upper = cube([-8, 8, -8], [16, 8, 16]);
  const highSouth = cube([-8, 8, 0], [16, 8, 8]);
  const lowSouth = cube([-8, 0, 0], [16, 8, 8]);

  if (shape === "cube") return geometry(id, [bone("root", [full])]);
  if (shape === "slab_bottom") return geometry(id, [bone("root", [lower])]);
  if (shape === "slab_top") return geometry(id, [bone("root", [upper])]);
  if (shape === "stair") return geometry(id, [bone("root", [lower, highSouth])]);
  if (shape === "stair_top") return geometry(id, [bone("root", [upper, lowSouth])]);

  const stairMatch = shape.match(/^stair_(inner|outer)_(left|right)(_top)?$/);
  if (stairMatch) {
    const [, kind, side, topMarker] = stairMatch;
    const top = Boolean(topMarker);
    const cubes = [top ? upper : lower];
    const sideX = side === "left" ? 0 : -8;
    if (kind === "inner") {
      cubes.push(top ? lowSouth : highSouth);
      cubes.push(cube([sideX, top ? 0 : 8, -8], [8, 8, 8]));
    } else {
      cubes.push(cube([sideX, top ? 0 : 8, 0], [8, 8, 8]));
    }
    return geometry(id, [bone("root", cubes)]);
  }

  if (shape === "door") return geometry(id, [bone("root", [cube([-8, 0, -1], [16, 16, 2])])]);
  if (shape === "trapdoor_bottom") return geometry(id, [bone("root", [cube([-8, 0, -8], [16, 3, 16])])]);
  if (shape === "trapdoor_top") return geometry(id, [bone("root", [cube([-8, 13, -8], [16, 3, 16])])]);
  if (shape === "trapdoor_open") return geometry(id, [bone("root", [cube([-8, 0, -1.5], [16, 16, 3])])]);

  if (shape === "fence") {
    return geometry(id, [
      bone("root", []),
      bone("post", [cube([-2, 0, -2], [4, 16, 4])], "root"),
      bone("north", [cube([-1.5, 5, -8], [3, 3, 6]), cube([-1.5, 11, -8], [3, 3, 6])], "root"),
      bone("east", [cube([2, 5, -1.5], [6, 3, 3]), cube([2, 11, -1.5], [6, 3, 3])], "root"),
      bone("south", [cube([-1.5, 5, 2], [3, 3, 6]), cube([-1.5, 11, 2], [3, 3, 6])], "root"),
      bone("west", [cube([-8, 5, -1.5], [6, 3, 3]), cube([-8, 11, -1.5], [6, 3, 3])], "root")
    ]);
  }

  if (shape === "wall") {
    return geometry(id, [
      bone("root", []),
      bone("post", [cube([-3, 0, -3], [6, 16, 6])], "root"),
      bone("north", [cube([-3, 0, -8], [6, 13, 5])], "root"),
      bone("north_tall", [cube([-3, 0, -8], [6, 16, 5])], "root"),
      bone("east", [cube([3, 0, -3], [5, 13, 6])], "root"),
      bone("east_tall", [cube([3, 0, -3], [5, 16, 6])], "root"),
      bone("south", [cube([-3, 0, 3], [6, 13, 5])], "root"),
      bone("south_tall", [cube([-3, 0, 3], [6, 16, 5])], "root"),
      bone("west", [cube([-8, 0, -3], [5, 13, 6])], "root"),
      bone("west_tall", [cube([-8, 0, -3], [5, 16, 6])], "root")
    ]);
  }

  if (shape === "pane") {
    return geometry(id, [
      bone("root", []),
      bone("post", [cube([-1, 0, -1], [2, 16, 2])], "root"),
      bone("north", [cube([-1, 0, -8], [2, 16, 7])], "root"),
      bone("east", [cube([1, 0, -1], [7, 16, 2])], "root"),
      bone("south", [cube([-1, 0, 1], [2, 16, 7])], "root"),
      bone("west", [cube([-8, 0, -1], [7, 16, 2])], "root")
    ]);
  }

  if (shape === "torch_floor") return geometry(id, [bone("root", [cube([-1, 0, -1], [2, 10, 2]), cube([-2, 8, -2], [4, 3, 4])])]);
  if (shape === "torch_wall") {
    return geometry(id, [
      bone("root", [
        cube([-1, 2, -5], [2, 10, 2], [35, 0, 0], [0, 4, -6]),
        cube([-2, 9, -1], [4, 3, 4], [35, 0, 0], [0, 4, -6])
      ])
    ]);
  }

  if (shape === "lantern" || shape === "lantern_hanging") {
    const hangingOffset = shape === "lantern_hanging" ? 2 : 0;
    return geometry(id, [
      bone("root", [
        cube([-3, hangingOffset, -3], [6, 8, 6]),
        cube([-4, 2 + hangingOffset, -4], [8, 4, 8]),
        cube([-2, 8 + hangingOffset, -1], [4, 3, 2]),
        ...(shape === "lantern_hanging" ? [cube([-1, 13, -1], [2, 3, 2])] : [])
      ])
    ]);
  }

  if (shape === "ladder") {
    const rungs = Array.from({ length: 6 }, (_, index) => cube([-5, 1 + index * 2.5, 6.5], [10, 1, 1]));
    return geometry(id, [bone("root", [cube([-7, 0, 6.5], [1, 16, 1]), cube([6, 0, 6.5], [1, 16, 1]), ...rungs])]);
  }

  if (shape.startsWith("button_")) {
    const placement = shape.slice("button_".length);
    const item = placement === "floor"
      ? cube([-3, 0, -2], [6, 2, 4])
      : placement === "ceiling"
        ? cube([-3, 14, -2], [6, 2, 4])
        : cube([-3, 6, 6], [6, 4, 2]);
    return geometry(id, [bone("root", [item])]);
  }

  if (shape.startsWith("lever_")) {
    const placement = shape.slice("lever_".length);
    const items = placement === "floor"
      ? [cube([-4, 0, -3], [8, 2, 6]), cube([-1, 2, -1], [2, 8, 2], [25, 0, 0], [0, 2, 0])]
      : placement === "ceiling"
        ? [cube([-4, 14, -3], [8, 2, 6]), cube([-1, 6, -1], [2, 8, 2], [-25, 0, 0], [0, 14, 0])]
        : [cube([-4, 5, 6], [8, 6, 2]), cube([-1, 5, 0], [2, 8, 2], [45, 0, 0], [0, 7, 6])];
    return geometry(id, [bone("root", items)]);
  }

  if (shape === "pressure_plate") return geometry(id, [bone("root", [cube([-7, 0, -7], [14, 1, 14])])]);
  if (shape === "sign") return geometry(id, [bone("root", [cube([-1, 0, -1], [2, 9, 2]), cube([-8, 8, -1], [16, 7, 2])])]);
  if (shape === "wall_sign") return geometry(id, [bone("root", [cube([-8, 5, 6.5], [16, 7, 1.5])])]);
  if (shape === "hanging_sign") {
    return geometry(id, [bone("root", [
      cube([-7, 3, -1], [14, 8, 2]),
      cube([-6, 11, -0.75], [2, 5, 1.5]),
      cube([4, 11, -0.75], [2, 5, 1.5])
    ])]);
  }

  if (shape === "rail_flat") return geometry(id, [bone("root", [cube([-8, 0, -8], [16, 0.75, 16])])]);
  if (shape === "rail_slope") {
    return geometry(id, [bone("root", [cube([-8, 0, -10], [16, 0.75, 20], [-26.5, 0, 0], [0, 0, 0])])]);
  }
  if (shape === "rail_curve") {
    return geometry(id, [bone("root", [
      cube([-8, 0, -8], [16, 0.75, 4]),
      cube([-8, 0, -8], [4, 0.75, 16])
    ])]);
  }
  if (shape === "redstone") {
    return geometry(id, [
      bone("root", []),
      bone("post", [cube([-2, 0, -2], [4, 0.8, 4])], "root"),
      bone("north", [cube([-1, 0, -8], [2, 0.65, 6])], "root"),
      bone("east", [cube([2, 0, -1], [6, 0.65, 2])], "root"),
      bone("south", [cube([-1, 0, 2], [2, 0.65, 6])], "root"),
      bone("west", [cube([-8, 0, -1], [6, 0.65, 2])], "root")
    ]);
  }
  if (shape === "carpet") return geometry(id, [bone("root", [cube([-8, 0, -8], [16, 1, 16])])]);
  if (shape === "chain") {
    return geometry(id, [bone("root", [
      cube([-0.75, 0, -2], [1.5, 16, 1.5]),
      cube([-2, 0, -0.75], [1.5, 16, 1.5])
    ])]);
  }
  if (shape === "chain_x") {
    return geometry(id, [bone("root", [
      cube([-8, 6, -2], [16, 1.5, 1.5]),
      cube([-8, 8, -0.75], [16, 1.5, 1.5])
    ])]);
  }
  if (shape === "chain_z") {
    return geometry(id, [bone("root", [
      cube([-2, 6, -8], [1.5, 1.5, 16]),
      cube([-0.75, 8, -8], [1.5, 1.5, 16])
    ])]);
  }
  if (shape === "rod") return geometry(id, [bone("root", [cube([-1, 0, -1], [2, 16, 2]), cube([-2, 0, -2], [4, 3, 4])])]);
  if (shape === "rod_x") return geometry(id, [bone("root", [cube([-8, 7, -1], [16, 2, 2]), cube([-8, 6, -2], [3, 4, 4])])]);
  if (shape === "rod_z") return geometry(id, [bone("root", [cube([-1, 7, -8], [2, 2, 16]), cube([-2, 6, -8], [4, 4, 3])])]);

  if (shape === "fence_gate_closed") {
    return geometry(id, [bone("root", [
      cube([-8, 0, -2], [3, 15, 4]),
      cube([5, 0, -2], [3, 15, 4]),
      cube([-5, 5, -1.5], [10, 2.5, 3]),
      cube([-5, 11, -1.5], [10, 2.5, 3]),
      cube([-1, 4, -1], [2, 10, 2])
    ])]);
  }
  if (shape === "fence_gate_open") {
    return geometry(id, [bone("root", [
      cube([-8, 0, -2], [3, 15, 4]),
      cube([5, 0, -2], [3, 15, 4]),
      cube([-7, 5, -1], [2.5, 2.5, 9]),
      cube([-7, 11, -1], [2.5, 2.5, 9]),
      cube([4.5, 5, -8], [2.5, 2.5, 9]),
      cube([4.5, 11, -8], [2.5, 2.5, 9])
    ])]);
  }

  const snowMatch = shape.match(/^snow_([1-8])$/);
  if (snowMatch) {
    const layers = Number(snowMatch[1]);
    return geometry(id, [bone("root", [cube([-8, 0, -8], [16, layers * 2, 16])])]);
  }

  if (shape === "campfire") {
    return geometry(id, [bone("root", [
      cube([-7, 1, -2], [14, 3, 4], [0, 45, 0], [0, 2, 0]),
      cube([-7, 1, -2], [14, 3, 4], [0, -45, 0], [0, 2, 0]),
      cube([-3, 3, -3], [6, 5, 6]),
      cube([-1, 8, -1], [2, 3, 2])
    ])]);
  }

  if (shape.startsWith("bell_")) {
    const placement = shape.slice("bell_".length);
    const mount = placement === "ceiling"
      ? [cube([-1, 13, -1], [2, 3, 2]), cube([-5, 12, -1], [10, 2, 2])]
      : placement === "wall"
        ? [cube([-1, 8, 5], [2, 2, 3]), cube([-5, 9, 5], [10, 2, 2])]
        : [cube([-1, 0, -1], [2, 5, 2]), cube([-5, 3, -1], [10, 2, 2])];
    const bellY = placement === "ceiling" ? 5 : placement === "wall" ? 4 : 5;
    return geometry(id, [bone("root", [
      ...mount,
      cube([-4, bellY, -4], [8, 6, 8]),
      cube([-5, bellY, -5], [10, 2, 10]),
      cube([-1, bellY - 2, -1], [2, 3, 2])
    ])]);
  }

  if (shape === "scaffold") {
    return geometry(id, [bone("root", [
      cube([-7, 0, -7], [2, 16, 2]),
      cube([5, 0, -7], [2, 16, 2]),
      cube([-7, 0, 5], [2, 16, 2]),
      cube([5, 0, 5], [2, 16, 2]),
      cube([-8, 14, -8], [16, 2, 2]),
      cube([-8, 14, 6], [16, 2, 2]),
      cube([-8, 14, -6], [2, 2, 12]),
      cube([6, 14, -6], [2, 2, 12])
    ])]);
  }

  if (shape === "anvil") {
    return geometry(id, [bone("root", [
      cube([-6, 0, -5], [12, 3, 10]),
      cube([-3, 3, -3], [6, 7, 6]),
      cube([-7, 10, -4], [14, 4, 8]),
      cube([-8, 11, -3], [16, 2, 6])
    ])]);
  }

  if (shape.startsWith("grindstone_")) {
    const placement = shape.slice("grindstone_".length);
    const wheel = placement === "wall"
      ? cube([-6, 3, 2], [12, 12, 5])
      : cube([-6, 3, -3], [12, 10, 6]);
    const supports = placement === "ceiling"
      ? [cube([-7, 12, -2], [3, 4, 4]), cube([4, 12, -2], [3, 4, 4])]
      : placement === "wall"
        ? [cube([-7, 2, 6], [3, 14, 2]), cube([4, 2, 6], [3, 14, 2])]
        : [cube([-7, 0, -2], [3, 5, 4]), cube([4, 0, -2], [3, 5, 4])];
    return geometry(id, [bone("root", [...supports, wheel, cube([-8, 7, -1], [16, 2, 2])])]);
  }

  if (shape === "stonecutter") {
    return geometry(id, [bone("root", [
      cube([-8, 0, -8], [16, 9, 16]),
      cube([-1, 9, -7], [2, 5, 14]),
      cube([-2, 12, -6], [4, 2, 12])
    ])]);
  }

  if (shape === "cactus") return geometry(id, [bone("root", [cube([-7, 0, -7], [14, 16, 14])])]);

  if (shape.startsWith("cluster_")) {
    const placement = shape.slice("cluster_".length);
    const cluster = placement === "ceiling"
      ? [
          cube([-2, 9, -2], [4, 7, 4]),
          cube([1, 9, -1], [3, 6, 3], [0, 0, 28], [0, 15, 0]),
          cube([-4, 10, -1], [3, 5, 3], [0, 0, -28], [0, 15, 0])
        ]
      : placement === "wall"
        ? [
            cube([-2, 5, 5], [4, 5, 3]),
            cube([1, 6, 3], [3, 4, 4], [-30, 0, 0], [0, 8, 7]),
            cube([-4, 7, 3], [3, 4, 4], [-20, 0, 0], [0, 8, 7])
          ]
        : [
            cube([-2, 0, -2], [4, 7, 4]),
            cube([1, 1, -1], [3, 6, 3], [0, 0, -28], [0, 1, 0]),
            cube([-4, 1, -1], [3, 5, 3], [0, 0, 28], [0, 1, 0])
          ];
    return geometry(id, [bone("root", cluster)]);
  }

  if (shape === "dripstone_floor") {
    return geometry(id, [bone("root", [
      cube([-3, 0, -3], [6, 4, 6]),
      cube([-2, 4, -2], [4, 5, 4]),
      cube([-1, 9, -1], [2, 5, 2])
    ])]);
  }
  if (shape === "dripstone_ceiling") {
    return geometry(id, [bone("root", [
      cube([-3, 12, -3], [6, 4, 6]),
      cube([-2, 7, -2], [4, 5, 4]),
      cube([-1, 2, -1], [2, 5, 2])
    ])]);
  }

  if (shape === "plant") {
    return geometry(id, [bone("root", [
      cube([-7, 0, -0.5], [14, 14, 1], [0, 45, 0], [0, 0, 0]),
      cube([-7, 0, -0.5], [14, 14, 1], [0, -45, 0], [0, 0, 0])
    ])]);
  }

  if (shape === "repeater" || shape === "comparator") {
    const torches = shape === "comparator"
      ? [
          cube([-5, 2, 2], [2, 5, 2]),
          cube([3, 2, 2], [2, 5, 2]),
          cube([-1, 2, -4], [2, 5, 2])
        ]
      : [cube([-1, 2, 3], [2, 5, 2]), cube([-1, 2, -4], [2, 5, 2])];
    return geometry(id, [bone("root", [cube([-7, 0, -8], [14, 2, 16]), ...torches])]);
  }

  if (shape === "sensor") {
    return geometry(id, [bone("root", [
      cube([-7, 0, -7], [14, 6, 14]),
      cube([-6, 6, -6], [2, 6, 2], [0, 0, -18], [-5, 6, -5]),
      cube([4, 6, -6], [2, 6, 2], [0, 0, 18], [5, 6, -5]),
      cube([-6, 6, 4], [2, 6, 2], [0, 0, -18], [-5, 6, 5]),
      cube([4, 6, 4], [2, 6, 2], [0, 0, 18], [5, 6, 5])
    ])]);
  }

  if (shape === "cake_full") return geometry(id, [bone("root", [cube([-7, 0, -7], [14, 8, 14])])]);
  if (shape === "cake_bitten") return geometry(id, [bone("root", [cube([-3, 0, -7], [10, 8, 14])])]);

  const corners = [];
  for (const x of [-8, 6]) for (const y of [0, 14]) for (const z of [-8, 6]) corners.push(cube([x, y, z], [2, 2, 2]));
  const edges = [
    cube([-6, 0.5, -7.5], [12, 1, 1]), cube([-6, 14.5, -7.5], [12, 1, 1]),
    cube([-6, 0.5, 6.5], [12, 1, 1]), cube([-6, 14.5, 6.5], [12, 1, 1]),
    cube([-7.5, 0.5, -6], [1, 1, 12]), cube([6.5, 0.5, -6], [1, 1, 12]),
    cube([-7.5, 14.5, -6], [1, 1, 12]), cube([6.5, 14.5, -6], [1, 1, 12]),
    cube([-7.5, 2, -7.5], [1, 12, 1]), cube([6.5, 2, -7.5], [1, 12, 1]),
    cube([-7.5, 2, 6.5], [1, 12, 1]), cube([6.5, 2, 6.5], [1, 12, 1])
  ];
  return geometry(id, [bone("root", [...corners, ...edges])]);
}

function coreGeometry() {
  return geometry("geometry.buildecho.core", [
    bone("root", [
      cube([-3, 3, -3], [6, 6, 6]),
      cube([-5, 5, -1], [10, 2, 2]),
      cube([-1, 5, -5], [2, 2, 10]),
      cube([-1, 1, -1], [2, 14, 2])
    ])
  ], [1.5, 2], false);
}

function createRenderController() {
  return {
    format_version: "1.8.0",
    render_controllers: {
      "controller.render.buildecho.echo": {
        arrays: {
          geometries: {
            "Array.geometries": shapes.map((shape) => `geometry.${shape}`)
          },
          textures: {
            "Array.textures": ["Texture.normal", "Texture.conflict"]
          }
        },
        geometry: "Array.geometries[q.property('buildecho:shape_id')]",
        materials: [{ "*": "Material.default" }],
        textures: ["Array.textures[q.property('buildecho:conflict') ? 1 : 0]"],
        part_visibility: [
          { north: "q.property('buildecho:north') && !q.property('buildecho:north_tall')" },
          { east: "q.property('buildecho:east') && !q.property('buildecho:east_tall')" },
          { south: "q.property('buildecho:south') && !q.property('buildecho:south_tall')" },
          { west: "q.property('buildecho:west') && !q.property('buildecho:west_tall')" },
          { north_tall: "q.property('buildecho:north_tall')" },
          { east_tall: "q.property('buildecho:east_tall')" },
          { south_tall: "q.property('buildecho:south_tall')" },
          { west_tall: "q.property('buildecho:west_tall')" },
          { post: "q.property('buildecho:post')" }
        ]
      }
    }
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createPng(pixel) {
  const width = 16;
  const height = 16;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

await mkdir(dirname(geometryPath), { recursive: true });
await mkdir(dirname(renderControllerPath), { recursive: true });
await mkdir(dirname(clientEntityPath), { recursive: true });
await mkdir(textureDirectory, { recursive: true });

const geometryDocument = {
  format_version: "1.12.0",
  "minecraft:geometry": [...shapes.map(geometryForShape), coreGeometry()]
};
await writeFile(geometryPath, `${JSON.stringify(geometryDocument, null, 2)}\n`);
await writeFile(renderControllerPath, `${JSON.stringify(createRenderController(), null, 2)}\n`);
await writeFile(clientEntityPath, `${JSON.stringify({
  format_version: "1.10.0",
  "minecraft:client_entity": {
    description: {
      identifier: "buildecho:echo",
      materials: {
        default: "entity_emissive_alpha"
      },
      textures: {
        normal: "textures/entity/buildecho_echo",
        conflict: "textures/entity/buildecho_conflict"
      },
      geometry: Object.fromEntries(shapes.map((shape) => [shape, `geometry.buildecho.${shape}`])),
      render_controllers: [
        "controller.render.buildecho.echo"
      ]
    }
  }
}, null, 2)}\n`);

await writeFile(join(textureDirectory, "buildecho_echo.png"), createPng((x, y) => {
  const border = x === 0 || y === 0 || x === 15 || y === 15;
  const pulse = x === 4 || x === 11;
  if (border) return [226, 255, 252, 255];
  if (pulse) return [145, 252, 246, 232];
  return [43, 207, 222, (x + y) % 2 === 0 ? 214 : 194];
}));
await writeFile(join(textureDirectory, "buildecho_conflict.png"), createPng((x, y) => {
  const border = x === 0 || y === 0 || x === 15 || y === 15;
  const pulse = x === 4 || x === 11;
  if (border) return [255, 235, 181, 255];
  if (pulse) return [255, 172, 92, 242];
  return [228, 66, 50, (x + y) % 2 === 0 ? 226 : 206];
}));
await writeFile(join(textureDirectory, "buildecho_core.png"), createPng((x, y) => {
  const edge = x === 0 || y === 0 || x === 15 || y === 15;
  const compass = x === 7 || x === 8 || y === 7 || y === 8;
  if (edge) return [255, 246, 193, 226];
  if (compass) return [216, 255, 244, 178];
  return [66, 207, 213, 48];
}));

console.log(`Generated ${shapes.length + 1} geometries, the client catalogue, one render controller, and three creator-owned textures.`);
