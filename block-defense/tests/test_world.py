"""地形と視線の当たり判定"""
from server import config as C
from server.world import World, ray_vox, ray_box


def test_generate_puts_cores_and_walls():
    w = World()
    w.generate(1, [(C.CX, C.CZ, "all")], 6)
    assert w.get(C.CX, C.G, C.CZ) == C.CORE
    assert w.get(C.CX, C.G + 1, C.CZ) == C.CORE
    assert len(w.plank_hp) > 0
    assert all(owner == "all" for owner in w.plank_owner.values())


def test_neighbour_steps_are_at_most_one_block():
    """となり合う地面の高さの差は1以内（歩いて登れる）"""
    w = World()
    w.generate(7, [(C.CX, C.CZ, "all")], 6)
    for z in range(C.D - 1):
        for x in range(C.W - 1):
            h = w.surface(x, z)
            if w.get(x, h - 1, z) in (C.GRASS, C.DIRT, C.STONE):
                for nx, nz in ((x + 1, z), (x, z + 1)):
                    nh = w.surface(nx, nz)
                    if w.get(nx, nh - 1, nz) in (C.GRASS, C.DIRT, C.STONE):
                        assert abs(h - nh) <= 1


def test_outside_world_is_solid():
    w = World()
    assert w.solid(-1, 5, 5) and w.solid(5, -1, 5)
    assert not w.solid(5, C.H + 1, 5)


def test_ray_vox_hits_floor():
    w = World()
    w.generate(1, [(C.CX, C.CZ, "all")], 6)
    hit = ray_vox(w, (C.CX + 3.5, C.G + 1.5, C.CZ + .5), (0, -1, 0), 10)
    assert hit is not None
    t, (x, y, z), v = hit
    assert y == C.G - 1 and abs(t - 1.5) < 1e-6


def test_ray_box():
    assert abs(ray_box((0, 0, 0), (1, 0, 0), (2, -1, -1), (3, 1, 1)) - 2) < 1e-9
    assert ray_box((0, 0, 0), (-1, 0, 0), (2, -1, -1), (3, 1, 1)) == -1


def test_encode_roundtrip_length():
    w = World()
    w.generate(3, [(C.CX, C.CZ, "all")], 6)
    import base64
    assert len(base64.b64decode(w.encode())) == C.W * C.H * C.D
