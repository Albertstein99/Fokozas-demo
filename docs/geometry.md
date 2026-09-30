# How the geometry works

[Back to the overview](../README.md)

## Three movement rules

A free point follows the pointer in world coordinates. A point constrained to
a line is placed at the orthogonal projection of the requested position onto
that line. A point constrained to a circle follows the radial direction from
the circle center to the requested position.

The shared interaction implementation supports all three rules. This demo
shows a free gray point and a circle-constrained orange point; the joining
line is a dependent construction, not a movement constraint for the orange point.

## Projective parameters

A constrained point can be described by a pair `(u:v)`. When `v` is nonzero,
its affine parameter is `u/v`. Multiplying both entries by the same nonzero
number does not change the parameter. The pair `(1:0)` represents infinite
parameter time, while `(0:0)` is invalid.

The mathematical implementation calls this value `HomogeneousScalar<T>`.
"Time" describes its role as a parameter; there is no separate time type and
the demo does not run an animation clock.

For the circle in this demo, one parametrization is

```text
P(u:v) = (5(v²-u²) : 10uv : u²+v²).
```

These are homogeneous point coordinates `(X:Y:Z)`. For `Z != 0`, the visible
coordinates are `(X/Z, Y/Z)`. Every coordinate above is a polynomial of degree
two in the parameter pair, and `X² + Y² = 25Z²`.

Examples:

| Parameter | Visible position |
| --- | --- |
| `(0:1)` | `(5, 0)` |
| `(1:2)` | `(3, 4)` |
| `(1:1)` | `(0, 5)` |
| `(1:0)` | `(-5, 0)` |

For real nonzero pairs, `u²+v²` never vanishes. The complete circle is therefore
covered without losing the point at infinite parameter time. Infinite parameter
time does not mean the visible point is infinitely far away.

## The joining line

For homogeneous points A and P, their cross product gives the coefficients of
the joining line. The application reevaluates this construction on every
successful point movement and when a cancelled drag restores the point.

If A and P coincide, the cross product is zero and the joining line is
undefined. The renderer omits it until the points separate.

## Precision and scope

The displayed application uses floating-point arithmetic. The symbolic formulas
describe exact incidence; numerical evaluation is subject to rounding.
The circle stays fixed in this demo. General conics, arbitrary curve solvers,
and a full editable dependency graph are outside its scope.
