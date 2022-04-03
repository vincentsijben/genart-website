---
layout: post
title: Randomness in p5.js
banner: 
  image: https://genart.nl/randomness/randomness-background.png
  opacity: 0.4
  background: "silver"
  heading_style: "font-size: 4.25em; font-weight: bold;"
categories: creative coding
tags: random, noise, seed, p5js, processing
date: April 4th, 2022
twitter-card: summary_large_image
twitter-title: Randomness in p5.js
twitter-description: An indepth article about randomness, seeds and noise in p5.js
twitter-image: https://genart.nl/randomness/randomness-background.png
---

 <details>
  <summary><b><u>TODO</u></b></summary>
- a lot
 </details>
 
 
Using a seed for the `random()` function is literally that: 'seeding' the formula that generates a new (pseudo) random number.
The formula p5js uses is: 
```
const m = 4294967296;
const a = 1664525;
const c = 1013904223;
Formula: (a * seed + c) % m
```
[source](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L25)

So when using `randomSeed(0)`, a `0` is entered into the formula: `(a * 0 + c) % m = 1013904223`. Because we only want normalized results (a result between 0 and 1), we divide the result by `m`, so we always end up with a number between 0 and 1.
The value for `m` needs to be very large (as it is the max period) and for its relationships to `a` and `c`. I won't be diving into that part 😎. 

The next time `random()` is called (without first manually setting a randomSeed) it will use the result from the previous calculation, in our case `1013904223`. So the next random number we get will be: `(a * 1013904223 + c) % m = 1196435762`.

You can feed `randomSeed()` with integers, floats or even negative numbers. Because of the [unsigned right shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift) (`value >>> 0`) in the [randomSeed](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L34) function, they will be converted to an integer between 0 and 4294967295.
- a positive integer will be the same after converting
- a negative number will be counted from the max integer backwards. So `-1` will be `4294967295` and `-2` will be `4294967294` etc. 
- a float will be converted to an integer by removing all decimals.

### Fun facts

1. `m` = 2<sup>32</sup> or 2 to the power of 32. Chrome and other browsers actually use 2<sup>128</sup> for their `Math.random()` period, using the [xorshift128+](https://v8.dev/blog/math-random) algorithm. That is a **lot** more, but P5js is still using the [LCG](https://en.wikipedia.org/wiki/Linear_congruential_generator) algorithm because it's easy to understand, easily implemented and fast.

2. Every consecutive call of `random()` will use the resulting seed from its previous call. `randomSeed(0)` will produce a new seed of `1013904223`. Therefor, calling `random()` 2 times when using `randomSeed(0)` will produce the same results  as calling `random()` 1 time using `randomSeed(1013904223)`.

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

That number `1664525` is exactly the [const a in the random() formula](https://github.com/processing/p5.js/blob/e32b45367baad694b1f4eeec0586b910bfcf0724/src/math/random.js#L17). So if you put in seeds incremented by 1, because of the multiplication with `a`, the difference between every result will also be `a`.

As you can see in the output table, this only applies for the first random() call! A second random call will not use a `2` for it's seed, but the result from seed `1`, be it `1015568748`. 

It doesn't matter if you use 1,2,3 or 10001, 10002, 10003. If the seeds are incremented by one, the resulting seed is incremented with `1664525`. The `random()` function always returns a number between 0 and 1 (because of the modulo `% m` and division by `m`). So if every new seed is `1664525` apart, the returned number from the `random()` function will be `1664525/4294967296 ≈ 0.00038` apart (const a / const m). 

That's a very tiny increase for every first random call as visualized here:



<img width="203" alt="image" src="https://user-images.githubusercontent.com/36117924/161337491-348cb1c4-af59-4b69-9ed0-c74dece79af7.gif" width="100"/><br>[source code](https://editor.p5js.org/Vincentsijben/sketches/VQheo8eoW)





#### Patterns using randomSeed
Check out the next example  with a grid of 9 circles that randomly move at a grid spot with the `random(-5,5)` function. The first random call in this example is for the x-position of the upper left circle (it's literally the first time random() is called after setting the seed). As we've seen, the first random call after consecutive seeds, aren't thát random. That's why it seems it's only moving vertically, but actually it moves a (very) tiny bit to the right each frame. 

Keep in mind: if you use a maximum number in your random() call like `random(-5,5)`, you've essentially expanded the range 10 times now (from 0-1, to 0-10 subtracting 5). The difference for each first random result will then be 10 fold (`≈ 0.0038`).
So in this example, the upper left circle will move 3.8 pixels to the right every 1000 frames or 16 seconds (1000/60). 

##### Fun facts
1. So if you wait long enough, it will start over or 'jump' to the left. How long you ask?
At frame 1971 it jumps from `4.999338067136705` to `-4.9967864085920155`.
If we look at the random formula and subtract `c` from `m`, then `a` will fit `(m-c)/a ≈ 1971` times in `m`.

2. If you wait long enough, the circle will be at its first random position again. How long you ask?
At frame 2580 we get roughly the same value (`-2.6365921273827553`) as the start value (`-2.6354447472840548`). The difference is only ≈ 0.0011 which is smaller than the 0.0038 difference each frame.
If we look at the random formula again, we can see that at its core (without offset `c`) we have a number `a` that fits 2580-ish times in `m` (`4294967296/1664525 ≈ 2580`) before going full circle #nopunintended 🤓.



<img width="203" alt="image" src="https://user-images.githubusercontent.com/36117924/161337043-bbb254f8-bb1b-43a1-bf5f-d9d2408fb70c.gif" width="100"/><br>[source code](https://editor.p5js.org/Vincentsijben/sketches/4let6smUn)

### Incrementing seeds by 10
So we've seen what results we get if we increment the seed by 1 every time. What results do we get if we increment with another amount, lets say 10?
Well, every seed is `1664525*10` apart, so the returned number from the `random()` function will be `(1664525*10)/4294967296 ≈ 0.0038` apart ( (const a * 10) / const m). So again, a 10 fold version of the increment of 1.

If you'd use `randomSeed(frameCount*100)` then every frame the circle moves 0.38 pixels. So each second it would 'travel' `60*0.38 ≈ 22` pixels (if it wasn't limited through a max random value). 

<img width="203" alt="image" src="https://user-images.githubusercontent.com/36117924/161350043-835acf67-9b54-4a12-a573-2d2180bc7311.gif" width="100"/>


<div style="left: 0; width: 500px; height: 0; position: relative; padding-bottom: 75%;"><iframe src="https://openprocessing.org/sketch/1533879/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 75%;"><iframe src="https://openprocessing.org/sketch/1355242/embed/?" style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;" allowfullscreen></iframe></div>

