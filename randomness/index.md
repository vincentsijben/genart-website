---
layout: post
title: Randomness in p5.js
banner: 
  image: https://genart.nl/randomness/randomness-background.png
  opacity: 0.4
  background: "silver"
  heading_style: "font-size: 4.25em; font-weight: bold; text-shadow: 2px 2px 2px #000; color: #FFF; "
categories: creative coding
tags: random, noise, seed, p5js, processing
date: April 4th, 2022
twitter-card: summary_large_image
twitter-title: Randomness in p5.js
twitter-description: An indepth article about randomness, seeds and noise in p5.js
twitter-image: https://genart.nl/randomness/randomness-background.png
---

## Random seeds
Using a seed for a `random()` function is literally that: 'seeding' the formula that generates a new (pseudo) random number.
The [formula p5js uses](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L25) is: 
```
const m = 4294967296;
const a = 1664525;
const c = 1013904223;
Formula: (a * seed + c) % m
```

So when using `randomSeed(0)`, a `0` is entered into the formula: `(a * 0 + c) % m = 1013904223`. Because we only want normalized results (a result between 0 and 1), we divide the result by `m`.
The value for `m` needs to be very large (as it is the max period) and for its relationships to `a` and `c`. I won't be diving into that part 😎. 

The next time `random()` is called (without first manually setting a randomSeed) it will use the result from the previous calculation, in our case `1013904223`. So the next random number we get will be: `(a * 1013904223 + c) % m = 1196435762`.

You can feed `randomSeed()` with integers, floats or even negative numbers. Because of the [unsigned right shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift) (`value >>> 0`) in the [randomSeed](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L34) function, they will be converted to an integer between 0 and 4294967295.
- a positive integer will be the same after converting
- a negative number will be counted from the max integer backwards. So `-1` will be `4294967295` and `-2` will be `4294967294` etc. 
- a float will be converted to an integer by removing all decimals.

That large number `4294967296` for `m` = 2<sup>32</sup> or 2 to the power of 32. Chrome and other browsers actually use 2<sup>128</sup> for their `Math.random()` period, using the [xorshift128+](https://v8.dev/blog/math-random) algorithm. That is a **lot** more, but P5js is still using the [LCG](https://en.wikipedia.org/wiki/Linear_congruential_generator) algorithm because it's easy to understand, easily implemented and fast.

Every consecutive call of `random()` will use the resulting seed from its previous call. `randomSeed(0)` will produce a new seed of `1013904223`. Therefor, calling `random()` 2 times when using `randomSeed(0)` will produce the same result  as calling `random()` 1 time using `randomSeed(1013904223)`.

## Consecutive seeds
Using different seeds in the draw function of p5js or processing, obviously generates different numbers. But having seeds that are close to each other, will produce numbers that **start** close as well. Because using `randomSeed(frameCount)` is a popular way of 'changing' seeds, here's the output for the first 5 frames:
```
frameCount  random call 1  random call 2
1           1015568748     1586005467
2           1017233273     1975575172
3           1018897798     2365144877
4           1020562323     2754714582
5           1022226848     3144284287
```
[source code](https://editor.p5js.org/Vincentsijben/sketches/WkFjPXnKM).

For all **random call 1**'s, the difference between every new seed is exactly 1664525 every single time (as long as you increment the seed with `1`, like in our example). 

That number `1664525` is exactly the [const a](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L17) in the `random()` formula. So if you put in seeds incremented by 1, because of the multiplication with `a`, the difference between every result will also be `a`.

As you can see in the output table, this only applies for the first random() call! A second random call will not use a `2` for it's seed, but the result from seed `1`, be it `1015568748`. 

It doesn't matter if you use 1,2,3 or 10001, 10002, 10003. If the seeds are incremented by one, the resulting seed is incremented with `1664525`. The `random()` function always returns a number between 0 and 1 (because of the modulo `% m` and division by `m`). So if every new seed is `1664525` apart, the returned number from the `random()` function will be `1664525/4294967296 ≈ 0.00038` apart (const a / const m). 

That's a very tiny increase for every first random call as visualized here:

<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 75%; margin-bottom: 20px;"><iframe src="https://openprocessing.org/sketch/1534704/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

Watch what happens if we add an extra `random()` call before our `let s = random(200);`. The visual drastically changes (as only the first `random()` call behaves like previously described).

<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 75%; margin-bottom: 20px;"><iframe src="https://openprocessing.org/sketch/1534741/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

### Patterns using randomSeed
Check out the next example  with a grid of 9 circles that randomly move at a grid spot with the `random(-15,15)` function. The first random call in this example is for the x-position of the upper left circle (it's literally the first time `random()` is called after setting the seed). As we've seen, the first random call after consecutive seeds, isn't thát random. That's why it seems it's only moving vertically, but actually it moves a (very) tiny bit to the right each frame. The framerate is set to 10, to slow things down:

<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 75%; margin-bottom: 20px;"><iframe src="https://openprocessing.org/sketch/1533879/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

Keep in mind: if you use any max number in your random call like `random(-15,15)`, you've essentially expanded the resulting range 30 times now, from 0-1 to 0-30 (subtracting 15). The formula [multiplies the result](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L147) with this expanded number (30 in our case), so the difference for each first random result will then be 30 fold (`≈ 0.0116`).
So in this example, the upper left circle will move 11.6 pixels to the right every 1000 frames. At a default frame rate of 60 fps, that would take 16 seconds. 

But wait, there are more patterns to be seen in this grid, right? Exactly! You can run [this sketch](https://editor.p5js.org/Vincentsijben/sketches/XmNB_sM0L) to get a nice overview of different amount of preceding `random()` calls per consecutive seed. If we set `amountOfPrecedingRandomCalls = 3` and `amountOfResults = 10`, we will get the next table, showing 10 consecutive seeds for 0, 1 ánd 2 extra random calls before actually calculating the `random()` we want. Be aware these are the normalized (0-1) results, so without the multiplication result of using `-15,15`.

```
seed	preceding random calls  result              	difference
1	0	                0.23645552527159452	0
2	0	                0.23684307769872248	0.00038755242712795734
3	0			0.23723063012585044	0.00038755242712795734
4	0			0.2376181825529784	0.00038755242712795734
5	0			0.23800573498010635	0.00038755242712795734
6	0			0.2383932874072343	0.00038755242712795734
7	0			0.23878083983436227	0.00038755242712795734
8	0			0.23916839226149023	0.00038755242712795734
9	0			0.23955594468861818	0.00038755242712795734
10	0			0.23994349711574614	0.00038755242712795734

1	1			0.3692706737201661	0
2	1			0.4599744388833642	0.09070376516319811
3	1			0.5506782040465623	0.09070376516319811
4	1			0.6413819692097604	0.09070376516319811
5	1			0.7320857343729585	0.09070376516319811
6	1			0.8227894995361567	0.09070376516319811
7	1			0.9134932646993548	0.09070376516319811
8	1			0.004197029862552881	-0.9092962348368019
9	1			0.094900795025751	0.09070376516319811
10	1			0.1856045601889491	0.09070376516319811

1	2			0.5042420323006809	0
2	2			0.18895030464045703	-0.31529172766022384
3	2			0.8736585769802332	0.6847082723397762
4	2			0.5583668493200094	-0.31529172766022384
5	2			0.2430751216597855	-0.31529172766022384
6	2			0.9277833939995617	0.6847082723397762
7	2			0.6124916663393378	-0.31529172766022384
8	2			0.297199938679114	-0.31529172766022384
9	2			0.9819082110188901	0.6847082723397762
10	2			0.6666164833586663	-0.31529172766022384
```

So what can we predict with this output? Well, knowing we are using a random call for x position and then a random call for y position, we can see that the first random call has differences of ≈ 0.00038, while the second random call has differences of ≈ 0.09. So the y-coördinate moves approx. 234 times faster than the x-coördinate, resulting in what seams a vertical movement only.

If you would use `amountOfPrecedingRandomCalls = 4` then you could predict the movement of circle number 2. The x-coördinate would jump left and right, and the y-coördinate moves 'slowly'.

### Incrementing seeds by 100
So we've seen what results we get if we increment the seed by 1 every time. What results do we get if we increment with another amount, lets say 100?
Well, every seed is `1664525*100` apart, so the returned number from the `random()` function will be `(1664525*100)/4294967296 ≈ 0.038` apart ( `(a * 100) / m`). So, a 100 fold version of the increment of 1. But still, a small amount: it takes 100 frames (about 2 seconds) to move 3.8 pixels.

If you'd use `randomSeed(frameCount*100)` and then `random(-15,15)`, then every frame the upper left circle moves `100 * 0.0116 = 1.16` pixels. So each second it would 'travel' `60*1.16 ≈ 70` pixels (if it wasn't limited through a max random value). 

<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 75%; margin-bottom: 20px;"><iframe src="https://openprocessing.org/sketch/1534706/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

### Fun facts
<details>
<summary>So if you wait long enough, the upper left circle will start over or 'jump' to the left. How long you ask?</summary>
  
At frame 1971 it jumps from `4.999338067136705` to `-4.9967864085920155`.
If we look at the random formula and subtract `c` from `m`, then `a` will fit `(m-c)/a ≈ 1971` times in `m`.
 </details>
 
<details>
<summary>Again, if you wait long enough, the circle will be at its first random position again. How long you ask?</summary>
  
At frame 2580 we get roughly the same value (`-2.6365921273827553`) as the start value (`-2.6354447472840548`). The difference is only ≈ 0.0011 which is smaller than the 0.0038 difference each frame.
If we look at the random formula again, we can see that at its core (without offset `c`) we have a number `a` that fits 2580-ish times in `m` (`4294967296/1664525 ≈ 2580`) before going full circle #nopunintended 🤓.
 </details>

 <details>
  <summary><b><u>TODO</u></b></summary>
- explain pattern of second random() call
- test all of this in processing which uses https://docs.oracle.com/javase/8/docs/api/java/util/Random.html
- a lot
  
  
 </details>
