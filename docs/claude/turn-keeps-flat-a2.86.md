# Turning keeps the flat view (a2.86)

Zeghreit, after testing a2.85: *"camera still works the same — it breaks into
perspective after I turn it."*

It did, and it was doing exactly what a2.61 asked for:

> *"after going into orthographic via tapping the cube, only turning the view
> (or the switch) switches back to perspective — moving and zooming stay in
> ortho."*

That rule was right for what the flat view WAS: an emulation, a long lens
pretending, which only really meant anything looking straight down an axis
after a cube tap. Something you visited and got returned from.

a2.85 made it a real orthographic camera and **left the rule standing**. A
parallel projection is just as true from three-quarters as from the front, so
orbiting in it is the ordinary way to work, not a state to be rescued from.
Every DCC and CAD tool orbits freely in ortho and leaves it only when told.

Every gesture now stays flat. The pill is the only thing that changes
projection; the cube still swings you in.

## What went with it

`ORTHO_TURN_COS`, `_turnFrom`, `_turnNow`, `watchingTurn`, both listeners'
turn logic, and `cubeAlignTo`'s re-arm. The `start` listener survives only to
cancel a cube swing, which was never about projection.

None of the deleted code was wrong, and the care in it is worth recording:

- it measured the camera-to-target VECTOR rather than asking the controls
  which gesture was running, so it worked for a wheel, a trackpad pinch and
  two fingers alike;
- the threshold was one degree rather than zero, so a sub-pixel wobble in a
  pan did not count as a turn;
- it was deliberately NOT disarmed on `end`, because damping keeps a flick
  turning for about a second after the finger leaves, and a fast flick has
  barely moved by lift-off — disarming early let that coast carry the view
  thirty degrees while the app still claimed a plan view.

The requirement underneath it stopped existing.

## The lesson

**When a change removes the reason for a rule, the rule is part of the
change.**

a2.85 was written to preserve behaviour — the working note said the turn rule
was decided and should not be touched. That instinct was wrong twice over: it
left the app doing the one thing the user would notice most, and it meant a2.85
shipped looking to him like nothing had happened at all, despite deleting an
entire depth-band subsystem and taking the projection from 0.5076° of
convergence to zero.

A justification that has been deleted should be re-examined in the same version
that deletes it, not inherited into the next one.

## Probes

`_theme_probe` section 9 keeps every one of its assertions and inverts two:
`9.turn_keeps_it` and `9.flick_coast` now check that a six-degree turn and the
whole damped coast after a flick leave the projection alone. `_proj_probe`
section 12 does the same at twenty degrees and gained `pill_still_leaves` —
"nothing drops you out" is only half the requirement; the other half is that
the pill still can, from a turned angle.

`_theme_probe`'s harness also learned to say WHY it gave up. Its bare
`ERROR=no __kubik` reads exactly like a hung app, and a stale Chrome profile
lock sent this version chasing an app that was fine for several rounds. It now
prints the page's own errors, `document.readyState`, the script count and
whether THREE loaded. **A diagnostic that cannot distinguish "broken" from
"could not start" costs more than it saves.**
