[TOC]



 # 浏览器渲染过程

前置：
- 浏览器架构
    - 公式 1： 浏览器 = 浏览器内核 + 服务（Chrome = Chromium + Google 服务集成）
    - 公式 2：内核 = 渲染引擎 + JavaScript 引擎 + 其他（Chrome：WebKit → BlinkV8）
- Chromium 进程模型（5 类进程，一般来说，当 Chrome 在强大的硬件上运行时，可能会将每项服务拆分为不同的进程，以提高稳定性；但如果是在资源有限的设备上，Chrome 会将各项服务合并为一个进程，从而节省内存占用量）
    <img alt="Chrome 服务化"  src="https://developer.chrome.com/static/blog/inside-browser-part1/image/chrome-servification-f06f547c54405.svg?hl=zh-cn" >
    - Browser Process：1 个
        - Render & Compositing Thread
        - Render & Compositing Thread Helpers
    - Utility Process（$ \textcolor{red}{还不知道是拿来干嘛的，但是确实是这样分）}$：1 个
    - Viz Process：1 个
        - GPU main thread
        - Display Compositor Thread
    - Plugin Process（拓展插件相关）：多个
    - Render Process：多个
        - Main thread x 1
        - Compositor thread x 1
        - Raster thread x 1
        - worker thread x N
- Chromium 的进程模式
    - Process-per-site-instance：老版本的默认策略，如果从一个页面打开了另一个新页面，而新页面和当前页面属于同一站点（根域名与协议相同）的话，那么这两个页面会共用一个 Render Process。
    - Process-per-site
    - Process-per-tab：如今版本的默认策略，每个 Tab 起一个 Render Process。但注意站点内部的跨站 iframe 也会启动一个新的 Render Process。可看下文 Example。
    - Single Process：单进程模式，启动参数可控，用于 Debug。

渲染流水线：

0.  帧开始（Frame Start）-> Input event handlers（合成线程将输入事件传递给主线程）-> requestAnimiationFrame执行
1.  Parsing(bytes → characters → token → nodes → object model (DOM Tree))
    - Loading：Blink 从网络线程接收 bytes
    - Conversion: HTMLParser 将 bytes 转为 characters
    - Tokenizing: 将 characters 转为 W3C 标准的 token(需要注意的是，这一步中如果解析到 link、script、img 标签时会继续发起网络请求；同时解析到 script 时，需要先执行完解析到的 JavaScript，才会继续往后解析 HTML。因为 JavaScript 可能会改变 DOM 树的结构(如 document.write() 等)，所以需要先等待它执行完)
    - Lexing: 通过词法分析将 token 转为 Element 对象
    - DOM construction: 使用构建好的 Element 对象构建 DOM Tree
2.  Style（DOM Tree 输出 Render Tree）
3.  Layout（Render Tree 输出 Layout Tree）
4.  Pre-paint（生成 Property trees，供 Compositor thread 使用，避免某些资源重复 Raster。 ）
5.  Paint（Blink 对接 cc 的绘制接口进行 Paint，生成 cc 模块的数据源 cc::Layer，Paint 阶段将 Layout Tree 中的 Layout Object 转换成绘制指令，并把这些操作封装在 cc::DisplayItemList 中，之后将其注入进 cc::PictureLayer 中||“生成绘制指令，这些绘制指令形成了一个绘制列表，在 Paint 阶段输出的内容就是这些绘制列表（SkPicture）。”）
6.  Commit（线程交换数据）
7.  Compositing（为什么需要 Compositor 线程？那我们假设下如果没有这个步骤，Paint 之后直接光栅化上屏又会怎样：如果直接走光栅化上屏，如果 Raster 所需要的数据源因为各种原因，在垂直同步信号来临时没有准备就绪，那么就会导致丢帧，发生 “Janky”。Graphics Layer(又称Compositing Layer)。在 DevTools 中这一步被称为 Composite Layers，主线程中的合成并不是真正的合成。主线程中维护了一份渲染树的拷贝（LayerTreeHost），在合成线程中也需要维护一份渲染树的拷贝（LayerTreeHostImpl）。有了这份拷贝，合成线程可以不必与主线程交互来进行合成操作。因此，当主线程在进行 Javascript 计算时，合成线程仍然可以正常工作而不被打断。
  在渲染树改变后，需要进行着两个拷贝的同步，主线程将改变后的渲染树和绘制列表发送给合成线程，同时阻塞主线程保证这个同步能正常进行，这就是 Composite Layers。这是渲染流水线中主线程的最后一步，换而言之，这一步只是生成了用于合成的数据，并不是真正的合成过程。）
8.  Tiling（根据不同的 scale 级别，不同的大小拆分为多个 cc::TileTask 任务给到 Raster 线程处理）
9.  Raster（位图填充，转化为像素值。这些图块的大小通常是 256256 或者 512512。光栅化可以分为软件光栅化（Software Rasterization）和硬件光栅化（Hardware Rasterization）， 区别在于位图的生成是在 CPU 中进行，之后再上传至 GPU 合成，还是直接在 GPU 中进行绘图和图像素填充）
10.  Activate（实现一个缓冲机制，确保 Draw 阶段操作前 Raster 的数据已准备好。具体而言将 Layer Tree 分成 Pending Tree 与 Active Tree，从 Pending Tree 拷贝 Layer 到 Activate Tree 的过程就是 Activate。）
11.  Draw（合成线程会收集被称为 draw quads 的图块信息用于创建合成帧（compositor frame）。合成帧被发送给 GPU 进程，这一帧结束）
12.  Aggregate（ $ \textcolor{red}{图像显示，暂时看不懂，没细看}$)
13.  Display（$ \textcolor{red}{图像显示，暂时看不懂，没细看}$）






下面的是网易文章的简洁总结：
*   收到垂直同步信号（Frame Start）
*   处理输入事件（Input event handlers）
*   requestAnimiationFrame
*   HTML 解析（Parse HTML）
*   样式计算（Recalc Styles）
*   布局（Layout，RenderObject）
*   更新渲染树（Update Layer Tree，RenderLayer）
*   绘制（Paint，分两步）
*   合成（Composite）
*   光栅化（Raster Scheduled and Rasterize）
*   帧结束（Frame End，GraphicsLayer）
*   图像显示
*   window\.onload()是等待页面完全加载完毕后触发的事件，而\$(function(){})在DOM树
  构建完毕后就会执行






下面是结合GPT的总结：

1. 解析（Parsing）

**输入**：HTML 字节码、CSS 字节码、JavaScript 字节码

**输出**：
- **DOM 树（Document Object Model）**：HTML 字节码解析生成的树状结构，表示文档的内容和结构。
- **CSSOM 树（CSS Object Model）**：CSS 字节码解析生成的树状结构，表示样式规则和它们的层叠顺序。
- **JavaScript 执行上下文**：JavaScript 字节码被解析和执行，可能会修改 DOM 和 CSSOM 树。

2. 样式计算（Style）

**输入**：DOM 树、CSSOM 树

**输出**：Styled DOM 树，其中每个节点包含样式信息。

浏览器将 CSS 样式应用到 DOM 树的各个元素上，计算每个元素的具体样式（例如颜色、字体、尺寸等）。

3. 布局（Layout）

**输入**：Styled DOM 树

**输出**：**布局树（Layout Tree）**

在布局阶段，浏览器根据已应用的样式信息计算每个元素在页面中的位置和尺寸，生成布局树。布局树是 DOM 树的几何表示，包含每个元素的尺寸和位置信息。

4. 生成 Property Trees（Transform、Clip、Effect、Scroll）

**输入**：布局树

**输出**：**Property Trees**

- **Transform Tree**：管理元素的变换属性（如 `transform`）。
- **Clip Tree**：管理元素的剪裁属性（如 `clip-path`）。
- **Effect Tree**：管理元素的效果属性（如 `opacity` 和 `filter`）。
- **Scroll Tree**：管理滚动信息。

这些树在布局完成之后生成，帮助优化后续的绘制和合成操作。

5. 预绘制（Pre-paint）

**输入**：布局树、Property Trees

**输出**：**图层树（Layer Tree）**

在预绘制阶段，浏览器会分析布局树和 Property Trees，生成图层树（Layer Tree）。图层树用于将页面内容划分为多个独立的图层（Render Layer），这些图层可以单独进行绘制和合成，从而提高渲染性能。

6. 绘制（Paint）

**输入**：图层树（Layer Tree）

**输出**：**绘制列表（Display List）**

浏览器会为每个图层生成绘制指令（绘制列表），这些指令描述了如何在屏幕上绘制每个元素（如背景、边框、文本等）。

7. 提交（Commit）

**输入**：绘制列表

**输出**：提交给合成器（Compositor）

绘制列表被提交给合成器，准备进入合成阶段。

8. 合成（Compositing）

**输入**：提交的绘制列表

**输出**：合成层列表（Composited Layer List）

合成器会将不同的图层组合在一起，生成合成层列表。

9. 平铺（Tiling）

**输入**：合成层列表

**输出**：平铺的图块（Tiles）

合成器将每个图层切分成多个小的图块，以便于更高效的渲染和更新。

10. 光栅化（Raster）

**输入**：平铺的图块

**输出**：光栅化的位图（Rasterized Bitmaps）

每个图块被光栅化，转换成实际的像素位图。

11. 激活（Activate）

**输入**：光栅化的位图

**输出**：准备绘制的图层（Ready-to-draw Layers）

光栅化的位图被激活，准备绘制到屏幕上。

12. 绘制（Draw）

**输入**：准备绘制的图层

**输出**：绘制命令（Draw Commands）

合成器生成绘制命令，这些命令将图层绘制到屏幕上。

13. 聚合（Aggregate）

**输入**：绘制命令

**输出**：最终显示的图像（Final Display Image）

所有的绘制命令被聚合，生成最终显示的图像。

14. 显示（Display）

**输入**：最终显示的图像

**输出**：用户看到的屏幕内容

最终的图像被显示到用户的屏幕上，完成整个渲染过程。



几个我关心的问题：

- **布局树（Layout Tree）**：在布局（Layout）阶段生成，包含每个元素的尺寸和位置信息。
- **Property Trees**：在布局完成后生成（布局和预绘制之间），管理各种渲染属性（变换、剪裁、效果、滚动）。
- **图层树（Layer Tree）**：在预绘制（Pre-paint）阶段生成，包含多个独立的图层，用于优化绘制和合成操作。





具体流程参考下面
<img src="./pic/渲染流程.png">

参考：

*   [浏览器渲染详细过程：重绘、重排和 composite 只是冰山一角](https://juejin.cn/post/6844903476506394638)
*   [从浏览器渲染原理谈动画性能优化](https://juejin.cn/post/7054055447052943396/#heading-14)
*   [Chromium 渲染流水线——字节码到像素的一生](https://blog.ursb.me/posts/chromium-renderer/)
*   [深入了解现代网络浏览器](https://developer.chrome.com/blog/inside-browser-part1?hl=zh-cn)

# js中的==
1. 如果操作数具有相同的类型，则按如下方式进行比较：
    - 对象（Object）：仅当两个操作数引用同一个对象时返回 true。
    - 字符串（String）：只有当两个操作数具有相同的字符且顺序相同时才返回 true。
    - 数值（Number）：如果两个操作数的值相同，则返回 true。+0 和 -0 被视为相同的值。如果任何一个操作数是 NaN，返回 false；所以，NaN 永远不等于 NaN。
    - 布尔值（Boolean）：仅当操作数都为 true 或都为 false 时返回 true。
    - 大整形（BigInt）：仅当两个操作数值相同时返回 true。
    - 符号（Symbol）：仅当两个操作数引用相同的符号时返回 true。
2. 如果其中一个操作数为 null 或 undefined，另一个操作数也必须为 null 或 undefined 以返回 true。否则返回 false。
3. 如果其中一个操作数是对象，另一个是基本类型，按此顺序使用对象的 @@toPrimitive()（以 "default" 作为提示），valueOf() 和 toString() 方法将对象转换为基本类型。（这个基本类型转换与相加中使用的转换相同。）
4. 在这一步，两个操作数都被转换为基本类型（String、Number、Boolean、Symbol 和 BigInt 中的一个）。其余的转换是逐个进行的。
    - 如果是相同的类型，使用步骤 1 进行比较。
    - 如果其中一个操作数是 Symbol 而另一个不是，返回 false。
    - 如果其中一个操作数是布尔型而另一个不是，则将布尔型转换为数字：true 转换为 1，false 转换为 0。然后再次松散地比较两个操作数。
    - String to Number：使用与 Number() 构造函数相同的算法将字符串转换为数字。转换失败将导致 NaN，这将保证相等是 false。
    - Number to BigInt：按数值进行比较。如果数值为 ±∞ 或 NaN，返回 false。
    - String to BigInt：使用与 BigInt() 构造函数相同的算法将字符串转换为 BigInt。如果转换失败，返回 false。

其中
> js核心内置类，会尝试valueOf先于toString；例外的是Date，Date利用的是toString转换。非js核心的对象，令说（比较麻烦，我也不大懂） eg:[].toString() == '' ; [1,2].toString() == '1,2'



参考：

*   [相等（==）- MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Equality)
*   [JS 基础知识点及常考面试题（二）](https://zhuanlan.zhihu.com/p/508403469)

# eventloop
* 前置
    * Event Loop 在浏览器内也分几种：
        * window event loop
        * worker event loop
        * worklet event loop
    * 这是一种运行机制（有的教程还说是一种线程，那个是错误的...）
    * 主线程运行的时候，产生堆（heap）和栈（stack）还有"任务队列"（task queue）(任务队列不在主线程外，是运行时产生的，MDN有描述;数据结构上是一个集合，而不是队列；一个 Event Loop 有一个或多个 task queues)
    * 栈中的代码执行完毕，主线程就会去读取"任务队列"
* 顺序（浏览器）
  <img src="./pic/eventloop.png"></img>
1. 执行全局Script同步代码，这些同步代码有一些是同步语句，有一些是异步语句（比如setTimeout等）；
2. 全局Script代码执行完毕后，调用栈Stack会清空；
3. 从微队列microtask queue中取出位于队首的回调任务，放入调用栈Stack中执行，执行完后microtask queue长度减1；
4. 继续取出位于队首的任务，放入调用栈Stack中执行，以此类推，直到直到把microtask queue中的所有任务都执行完毕。注意，如果在执行microtask的过程中，又产生了microtask，那么会加入到队列的末尾，也会在这个周期被调用执行；
5. microtask queue中的所有任务都执行完毕，此时microtask queue为空队列，调用栈Stack也为空；
6. 取出宏队列macrotask queue中位于队首的任务，放入Stack中执行；
7. 执行完毕后，调用栈Stack为空；
8. 重复第3-7个步骤；
9. 重复第3-7个步骤；
10. ......

注意：
- 宏队列macrotask一次只从队列中取一个任务执行，执行完后就去执行微任务队列中的任务；
- 微任务队列中所有的任务都会被依次取出来执行，知道microtask queue为空；
- 图中没有画UI rendering的节点，因为这个是由浏览器自行判断决定的($ \textcolor{red}{这很重要，但是具体机制暂不清楚}$)，但是只要执行UI rendering，它的节点是在执行完所有的microtask之后，下一个macrotask之前，紧跟着执行UI render

* Node环境

    - timers 阶段。

    在 timers 阶段会执行已经被 `setTimeout()` 和 `setInterval()` 的调度回调函数。

    - pending callbacks 阶段。

    上一次[循环队列](https://www.zhihu.com/search?q=%E5%BE%AA%E7%8E%AF%E9%98%9F%E5%88%97&search_source=Entity&hybrid_search_source=Entity&hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2398610293%7D)中，还未执行完毕的会在这个阶段进行执行。比如延迟到下一个 Loop 之中的 I/O 操作。

    - idle, prepare

    其实这一步我们不需要过多的关系，它仅仅是在 NodeJs 内部调用。我们无法进行操作这一步，所以我们仅仅了解存在 idle prepare 这一层即可。

    - poll

    这一阶段被称为[轮询](https://www.zhihu.com/search?q=%E8%BD%AE%E8%AF%A2&search_source=Entity&hybrid_search_source=Entity&hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2398610293%7D)阶段，它主要会检测新的 I/O 相关的回调，需要注意的是这一阶段会存在阻塞（也就意味着这之后的阶段可能不会被执行）。`setImmediate()`和`setTimeout()`不是一定先timer后check,可能提前执行，所以下图才会这么画。官方也存在描述

    - check

    check 阶段会检测 `setImmediate()` 回调函数在这个阶段进行执行。

    - close callbacks

    这个阶段会执行一系列关闭的[回调函数](https://www.zhihu.com/search?q=%E5%9B%9E%E8%B0%83%E5%87%BD%E6%95%B0&search_source=Entity&hybrid_search_source=Entity&hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2398610293%7D)，比如如：`socket.on('close', ...)`。

    **其实 NodeJs 中的事件循环机制主要就是基于以上几个阶段，但是对于我们比较重要的来说仅仅只有 timers、poll 和 check 阶段，因为这三个阶段影响着我们代码书写的执行顺序。**

    几个注意点：

    * node事件队列本质和浏览器中是类似的，虽然 NodeJs 下存在多个[执行队列](https://www.zhihu.com/search?q=%E6%89%A7%E8%A1%8C%E9%98%9F%E5%88%97&search_source=Entity&hybrid_search_source=Entity&hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2398610293%7D)，但是每次执行逻辑是相同的：**同样是执行完成一个宏任务后会立即清空当前队列中产生的所有微任务。**

      >  当然在 NodeJs < 10.0 下的版本，它是会清空一个队列之后才会清空当前队列下的所有 Micro。

    * `setImmediate()`和`setTimeout()`先后顺序执行取决于timer的延迟时间以及电脑性能（看参考文章中的知乎回答，写得非常好

    * 面试题：如何保证setImmediate()先于setTimeout()执行。（异步IO回调操作中肯定先check阶段才是timer

    ​

    <img src="./pic/nodeeventloop.png"></img>



* 宏任务（macrotask，也叫task）
    - script
    - setTimeout
    - setInterval
    - setImmediate
    - I/O
    - UI rendering
* 微任务（microtask，也叫jobs）
    - MutationObserver
    - Promise.then()/catch()
    - 以 Promise 为基础开发的其他技术，例如 fetch API
    - V8 的垃圾回收过程
    - Node 独有的 process.nextTick（这个其实官方并不是这么认为，但是可以这么理解）
    - Object.observe




参考：

*   [带你彻底弄懂Event Loop](https://segmentfault.com/a/1190000016278115#item-2-1)
*   [JS 基础知识点及常考面试题（二）](https://zhuanlan.zhihu.com/p/508403469)
*   [关于Node.js EventLoop的poll阶段该如何理解？ - WangHaoyu的回答 - 知乎](https://www.zhihu.com/question/330124623/answer/2398610293)
    ​


# requestAnimationFrame

1. $ \textcolor{red}{疑惑}$:60hz频率下不是应该等待硬件提供的16ms一次的机会来刷新吗？下面截图第二个输出是标准的
  <img src="./pic/requestAnimationFrame 执行截图.png">

```javascript
function test() {
    var s = performance.now();
    requestAnimationFrame(() => {
        console.log(performance.now() - s, 'requestAnimationFrame do');
        requestAnimationFrame(() => {
            console.log(performance.now() - s, 'requestAnimationFrame2 do');
            requestAnimationFrame(() => {
                console.log(performance.now() - s, 'requestAnimationFrame3 do');
            });
        });
    });
}

test();

```
2. RAF是宏任务还是微任务还是有争议的，我认为应该单独拿出来算（就像上面的渲染管线流程图一样），对于运行时机需要考虑浏览器以及具体代码，不能简单约等于微任务
3. 浏览器新旧版本执行差异很大，很多文章的代码执行顺序已经发生变化了


$ \textcolor{red}{在这段代码所有最新版浏览器都是从右往左移动了，\\是不是间接说明了现在主流浏览器执行 requestAnimationFrame 回调的时机是在 1 帧渲染之后，\\所以当前帧调用的 requestAnimationFrame 会在下一帧呈现}$




```js
test.style.transform = 'translate(0, 0)';
document.querySelector('button').addEventListener('click', () => {
  const test = document.querySelector('.test');
  test.style.transform = 'translate(400px, 0)';

  requestAnimationFrame(() => {
    test.style.transition = 'transform 3s linear';
    test.style.transform = 'translate(200px, 0)';
  });
});
```
这位提出者直到今天仍然还在重复反馈这个缺陷
![issue](./pic/github问题.png)

* 理论上，raf 是在微任务队列执行完之后，css计算之前或者说下一个宏任务前执行
  具体可以参考下面，是别人文章搬运过来（他从规范中翻译过来的

  1. 从任务队列中取出一个**宏任务**并执行。

  2. 检查微任务队列，执行并清空**微任务**队列，如果在微任务的执行中又加入了新的微任务，也会在这一步一起执行。

  3. 进入更新渲染阶段，判断是否需要渲染，这里有一个 `rendering opportunity` 的概念，也就是说不一定每一轮 event loop 都会对应一次浏览 器渲染，要根据屏幕刷新率、页面性能、页面是否在后台运行来共同决定，通常来说这个渲染间隔是固定的。（所以多个 task 很可能在一次渲染之间执行）

  4. - 浏览器会尽可能的保持帧率稳定，例如页面性能无法维持 60fps（每 16.66ms 渲染一次）的话，那么浏览器就会选择 30fps 的更新速率，而不是偶尔丢帧。
     - 如果浏览器上下文不可见，那么页面会降低到 4fps 左右甚至更低。
     - 如果满足以下条件，也会跳过渲染：

  5. 1. 浏览器判断更新渲染不会带来视觉上的改变。
     2. `map of animation frame callbacks` 为空，也就是帧动画回调为空，可以通过 `requestAnimationFrame` 来请求帧动画。

  6. 如果上述的判断决定本轮**不需要渲染**，那么**下面的几步也不会继续运行**：

     > This step enables the user agent to prevent the steps below from running for other reasons, for example, to ensure certain tasks are executed immediately after each other, with only microtask checkpoints interleaved (and without, e.g., animation frame callbacks interleaved). Concretely, a user agent might wish to coalesce timer callbacks together, with no intermediate rendering updates. 有时候浏览器希望两次「定时器任务」是合并的，他们之间只会穿插着 `microTask`的执行，而不会穿插屏幕渲染相关的流程（比如`requestAnimationFrame`，下面会写一个例子）。

  7. 对于需要渲染的文档，如果窗口的大小发生了变化，执行监听的 `resize` 方法。

  8. 对于需要渲染的文档，如果页面发生了滚动，执行 `scroll` 方法。

  9. 对于需要渲染的文档，执行帧动画回调，也就是 **requestAnimationFrame** 的回调。（后文会详解）

  10. 对于需要渲染的文档， 执行 IntersectionObserver 的回调。

  11. 对于需要渲染的文档，**重新渲染**绘制用户界面。

  12. 判断 `task队列`和`microTask`队列是否都为空，如果是的话，则进行 `Idle` 空闲周期的算法，判断是否要执行 **requestIdleCallback** 的回调函数。（后文会详解）

  对于`resize` 和 `scroll`来说，并不是到了这一步才去执行滚动和缩放，那岂不是要延迟很多？浏览器当然会立刻帮你滚动视图，根据CSSOM 规范[2]所讲，浏览器会保存一个 `pending scroll event targets`，等到事件循环中的 `scroll`这一步，去派发一个事件到对应的目标上，驱动它去执行监听的回调函数而已。`resize`也是同理。

  也可以参考下图：
  <img src="./pic/raf 理论执行时机.png"></img>
   但是我在阅读文章中有很多例子颠覆我的看法（chrome125）
```js
setTimeout(() => {
  console.log("sto")
  requestAnimationFrame(() => console.log("rAF"))
})
setTimeout(() => {
  console.log("sto")
  requestAnimationFrame(() => console.log("rAF"))
})

queueMicrotask(() => console.log("mic"))
queueMicrotask(() => console.log("mic"))
```
作者认为这是[定时器合并（这文章的序号编排有问题，最好是去他微信公众号看）](https://zhuanlan.zhihu.com/p/142742003),我觉得和上文的解释有点出入，发现评论区有人指出

<img src="./pic/RAF讨论评论区截图.png"></img>
于是我改了一下案例，加入延迟参数1ms
<img src="./pic/raf案例代码修改.png"></img>
如果想要说明会合并定时器，应该用下面这个
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Timer Callback Example</title>
</head>
<body>

<div id="output"></div>

<script>
  function logMessage(message) {
    const outputDiv = document.getElementById('output');
    const newMessage = document.createElement('p');
    newMessage.textContent = message;
    outputDiv.appendChild(newMessage);
  }

  // Simulate tasks that should be executed one after another
  function task1() {
    logMessage('Task 1 executed');
  }

  function task2() {
    logMessage('Task 2 executed');
  }

  function task3() {
    logMessage('Task 3 executed');
  }

  // Use setTimeout to schedule tasks
  setTimeout(() => {
    task1();
    task2();
    task3();
  }, 0);

  // Simulate an animation frame callback
  requestAnimationFrame(() => {
    logMessage('Animation frame callback executed');
  });

</script>

</body>
</html>
```
但又有个新的问题 

$ \textcolor{red}{“一个事件循环时间”浏览器怎么判断的呢，\\60hz频率下16ms?减去插件或者其他渲染相关，10ms左右一个事件循环??}$

$ \textcolor{red}{疑惑：下面多跑几次就发现执行结果顺序不一定，上面的则不会 \\（我都点怀疑是不是和node 中timer和check的问题类似}$

```js
setTimeout(() => {
    console.log('setTimeout');
}, 0);
Promise.resolve()
    .then(() => {
        console.log(2);
    })
    .then(() => {
        console.log(3);
    });
new Promise((resolve) => {
    console.log(4);
    resolve();
})
    .then(() => {
        console.log(5);
        return 6;
    })
    .then(Promise.resolve(7))
    .then((res) => {
        console.log(res);
    });
 setTimeout(() => {
     console.log('setTimeout2');
 });
requestAnimationFrame(() => {
    console.log('animation’');
});
```
<img src="./pic/raf多次执行结果不一致.png">


```js
setTimeout(() => {
    console.log('setTimeout');
}, 0);
Promise.resolve()
    .then(() => {
        console.log(2);
    })
    .then(() => {
        console.log(3);
    });
new Promise((resolve) => {
    console.log(4);
    resolve();
})
    .then(() => {
        console.log(5);
        return 6;
    })
    .then(Promise.resolve(7))
    .then((res) => {
        console.log(res);
    });
requestAnimationFrame(() => {
    console.log('animation’');
});
```



<img src="./pic/raf多次执行结果不一致2.png"></img>

参考：


* [为什么每次requestAnimationFrame的回调第一次都是立即执行](https://www.zhihu.com/question/456804188)
* [rAF在EventLoop的表现](https://www.cnblogs.com/zhangmingzhao/p/18028506)
* [requestAnimationFrame 执行机制探索](https://zhuanlan.zhihu.com/p/432195854)
* [深入解析 EventLoop 和浏览器渲染、帧动画、空闲回调的关系](https://zhuanlan.zhihu.com/p/142742003)
* [requestAnimationFrame回调时机](https://zhuanlan.zhihu.com/p/64917985)
* [html规范](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model)

#   requestIdleCallback

浏览器一帧内六个步骤的任务：

- 处理用户的交互
- JS 解析执行
- 帧开始。窗口尺寸变更，页面滚去等的处理
- rAF
- 布局
- 绘制

上面六个步骤完成后没超过 16 ms，说明时间有富余，此时就会执行 requestIdleCallback 里注册的任务。

* **对非高优先级的任务使用空闲回调**

* **空闲回调应尽可能不超支分配到的时间**（目前，[`timeRemaining()`](https://developer.mozilla.org/zh-CN/docs/Web/API/IdleDeadline/timeRemaining) 有一个 50 ms 的上限时间，但实际上你能用的时间比这个少，因为在复杂的页面中事件循环可能已经花费了其中的一部分，浏览器的扩展插件也需要处理时间，等等

* **避免在空闲回调中改变 DOM**（如果你的回调需要改变 DOM，它应该使用 Window.requestAnimationFrame() 来调度它。）

* **避免运行时间无法预测的任务**（避免做任何会影响页面布局的事情）

* **在你需要的时候要用 timeout，但记得只在需要的时候才用**（用 timeout 可以保证你的代码按时执行，但是在剩余时间不足以强制执行你的代码的同时保证浏览器的性能表现的情况下，timeout 就会造成延迟或者动画不流畅

  MDN中处理兼容提供的例子（非 polyfill）

  ```js
  window.requestIdleCallback =
    window.requestIdleCallback ||
    function (handler) {
      let startTime = Date.now();

      return setTimeout(function () {
        handler({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50.0 - (Date.now() - startTime));
          },
        });
      }, 1);
    };

  window.cancelIdleCallback =
    window.cancelIdleCallback ||
    function (id) {
      clearTimeout(id);
    };
  ```


参考：

- [MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/Background_Tasks_API)

# setTimeOut最小延时问题（setInterval也一样）

- 在浏览器中，`setTimeout` 大致符合 [HTML5 标准](https://link.zhihu.com/?target=https%3A//html.spec.whatwg.org/multipage/timers-and-user-prompts.html%23dom-settimeout)，**如果嵌套的层级超过了 5 层，并且 timeout 小于 4ms，则设置 timeout 为 4ms**

- 在 `nodejs` 中，如果设置的 `timeout` 为 0ms，则会被重置为 1ms，并且没有嵌套限制。

- 在 `deno` 中，也实现了类似 HTML5 标准 的行为，不过其底层是通过 Rust `tokio` 库实现的，该库的延时粒度取决于其执行的环境，某些平台将提供分辨率大于 1 毫秒的计时器。

- 在 `Bun` 中，如果设置的 `timeout` 为 0ms，则会被直接加入到任务队列中，所以 `bun` 中的循环次数会非常高。



  参考：

- [你真的了解 setTimeout 么？聊聊 setTimeout 的最小延时问题（附源码细节）](https://zhuanlan.zhihu.com/p/614819835)





# scorll和resize节流

> `resize`和`scroll`事件其实自带节流，它只在 Event Loop 的渲染阶段去派发事件到 `EventTarget` 上。

- 防抖动：防抖技术即是可以把多个顺序地调用合并成一次，也就是在一定时间内，规定事件被触发的次数（我只执行你最后一次停下后的操作回调，你一直给我就一直取消执行前面的）。
- 节流函数：只允许一个函数在 X 毫秒内执行一次，只有当上一次函数执行后过了你规定的时间间隔，才能进行下一次该函数的调用,一定时间内至少执行一次我们希望触发的事件 handler（我只执行你第一次操作，操作完了才接受新回调）。

scroll防抖

```js
// 防抖动函数
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
 
var myEfficientFn = debounce(function() {
    // 滚动中的真正的操作
}, 250);
 
// 绑定监听
window.addEventListener('resize', myEfficientFn);
```

scroll 节流

```js
// 简单的节流函数
function throttle(func, wait, mustRun) {
    var timeout,
        startTime = new Date();
 
    return function() {
        var context = this,
            args = arguments,
            curTime = new Date();
 
        clearTimeout(timeout);
        // 如果达到了规定的触发时间间隔，触发 handler
        if(curTime - startTime >= mustRun){
            func.apply(context,args);
            startTime = curTime;
        // 没达到触发间隔，重新设定定时器
        }else{
            timeout = setTimeout(func, wait);
        }
    };
};
// 实际想绑定在 scroll 事件上的 handler
function realFunc(){
    console.log("Success");
}
// 采用了节流函数
window.addEventListener('scroll',throttle(realFunc,500,1000));
```

scroll 节流(raf版本)

```js
let lastKnownScrollPosition = 0;
let ticking = false;

function doSomething(scrollPos) {
  // 利用滚动位置完成一些事情
}

document.addEventListener("scroll", (event) => {
  lastKnownScrollPosition = window.scrollY;

  if (!ticking) {
    window.requestAnimationFrame(() => {
      doSomething(lastKnownScrollPosition);
      ticking = false;
    });

    ticking = true;
  }
});
// 滚动事件监听（类似上面的throttle(func, xx, 16.7) 
window.addEventListener('scroll', onScroll, false);

```

> 然而需要注意的是，输入事件和动画帧的触发速度大致相同，因此通常不需要下述优化。此示例使用 `requestAnimationFrame` 优化 `scroll` 事件。



resize(防抖)

```js
var timeout = false // holder for timeout id
var delay = 250 // delay after event is "complete" to run callback
   

// window.resize callback function
function doSomething() {
  console.log('yoo')
}

// window.resize event listener
window.addEventListener('resize', function() {
  // clear the timeout
  clearTimeout(timeout);
  // start timing for event "completion"
  timeout = setTimeout(doSomething, delay);
});


```





resize(节流)

```js

var delay = 250, // delay between calls
    throttled = false // are we currently throttled?
   

// window.resize callback function
function doSomething() {
  console.log('yoo')
}


// window.resize event listener
window.addEventListener('resize', function() {
  // only run if we're not throttled
  if (!throttled) {
    // actual callback action
    doSomething();
    // we're throttled!
    throttled = true;
    // set a timeout to un-throttle
    setTimeout(function() {
      throttled = false;
    }, delay);
  }  
});



```

参考：

- [Optimizing window.onresize](https://web.archive.org/web/20220714020647/https://bencentra.com/code/2015/02/27/optimizing-window-resize.html)
- [[【前端性能】高性能滚动 scroll 及页面渲染优化](https://www.cnblogs.com/coco1s/p/5499469.html)](https://www.cnblogs.com/coco1s/p/5499469.html)
- [Document：scroll 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/scroll_event)




# 原型链

没啥好说的，就是下图全概括了

<img src="./pic/原型链图.png"></img>



控制台打印实例对象身上的`[[Prototype]]`似乎就是`__proto__`



# Javascript如何实现继承

- 原型链继承

  ```js
  function Parent(){
  		this.name ='parent1';
    		this.play=[1,2,3]
  }
  function child(){
    this.type ='child2'
  };
  child.prototype =new Parent();
  console.log(new child())
  ```

改变 s1 的 play 属性，会发现 s2 也跟着发生变化了，这是因为两个实例使用的是同一个原型对象，内存空间是共享的
  ```js

  var s1 = new child();
  var s2 = new child();
  s1.play.push(4);
  console.log(s1.play,s2.play);//[1,2,3,4]
  ```

  

- 构造函数继承(借助 call)

```js
function Parent(){
  this.name ='parent1'
};
Parent.prototype.getName=function(){
  return this.name
};
function Child(){
  Parent.call(this);
  this.type ='child'
}
let child = new Child();
console.log(child);
console.log(child.getName()); // 报错
```

可以看到，父类原型对象中一旦存在父类之前自己定义的方法，那么子类将无法继承这些方法相比第一种原型链继承方式，父类的引用属性不会被共享，优化了第一种继承方式的弊端，但是只能继承父类的实例属性和方法，不能继承原型属性或者方法

- 组合继承

```js
function Parent3 () {
 this.name = 'parent3';
 this.play = [1, 2, 3];
}
Parent3.prototype.getName = function () {
 return this.name;
}
function Child3() {
 // 第二次调用Parent3()
 Parent3.call(this);
 this.type = 'child3';
}
// 第一次调用Parent3()
Child3.prototype = new Parent3();
// 这一步不是必要，只是让结构看起来更规范
Child3.prototype.constructor = Child3;
var s3 = new Child3();
var s4 = new Child3();
s3.play.push(4);
console.log(s3.play, s4.play); //不互相影响 
console.log(s3.getName()); // 'parent3'
console.log(s4.getName()); // 'parent3'
```

这种方式看起来就没什么问题，方式一和方式二的问题都解决了，但是从上面代码我们也可以看到 Palent3 执行了两次，造成了多构造一次的性能开销

- 原型式继承

```js
let parent4 = {
 	name: "parent4",
 	friends: ["p1", "p2", "p3"],
 	getName: function() {
 		return this.name;
 	}
 };
 let person4 = Object.create(parent4);
 person4.name = "tom";
 person4.friends.push("jerry");
 let person5 = Object.create(parent4);
 person5.friends.push("lucy");
 console.log(person4.name); // tom
 console.log(person4.name === person4.getName()); // true
 console.log(person5.name); // parent4
 console.log(person4.friends); // ["p1", "p2", "p3","jerry","lucy"]
 console.log(person5.friends); // ["p1", "p2", "p3","jerry","lucy"]
```

这种继承方式的缺点也很明显，因为 0bject.create 方法实现的是浅拷贝，多个实例的引用类型属性指向相同的内存，存在篡改的可能

- 寄生式继承

```js
let parent5 = {
 	name: "parent5",
 	friends: ["p1", "p2", "p3"],
 	getName: function() {
 		return this.name;
 	}
};
function clone(original) {
 	let clone = Object.create(original);
 	clone.getFriends = function() {
 		return this.friends;
 	};
 	return clone;
}
let person5 = clone(parent5);
let person6 = clone(parent5);
 person6.friends.push("lucy");
console.log(person5.getName()); // parent5
console.log(person5.getFriends()); // ["p1", "p2", "p3", "lucy"]
```

寄生式继承在上面继承基础上进行优化，利用这个浅拷贝的能力再进行增强，添加一些方法(其实和上面的区别不大，我认为只是另一种写法罢了)，缺点还是和原型式一样

- 寄生组合式继承

```js
function clone (parent, child) {
 // Object.create 其实就是这里有区别而已，不用实例化一次，至于性能我不确定和直接实例化有什么优势
 child.prototype = Object.create(parent.prototype);
 child.prototype.constructor = child;
}
function Parent6() {
 this.name = 'parent6';
 this.play = [1, 2, 3];
}
Parent6.prototype.getName = function () {
 return this.name;
}
function Child6() {
 Parent6.call(this);
 this.friends = 'child5';
}
clone(Parent6, Child6);
Child6.prototype.getFriends = function () {
 return this.friends;
}
let person6 = new Child6();
console.log(person6); //{friends:"child5",name:"child5",play:[1,2,3],__pro
//to__:Parent6}
console.log(person6.getName()); // parent6
console.log(person6.getFriends()); // child5

```

* es6

  ```js
  class Person {
   constructor(name) {
   this.name = name
   }
   // 原型方法
   // Person.prototype.getName = function() { }
   // getName() {...}
   getName = function () {
   console.log('Person:', this.name)
   }
  }
  class Gamer extends Person {
   constructor(name, age) {
   // 子类中存在构造函数，则需要在使用“this”之前首先调用 super()
   super(name)
   this.age = age
   }
  }
  const asuna = new Gamer('Asuna', 20)
  asuna.getName() // 成功访问到分类
  ```

  利用 babel 工具进行转换，我们会发现 extends 实际采用的也是寄生组合继承方式，因此也证明了这种方式是较优的解决继承的方式

总结如下图：但是我觉得就三类，构造函数继承和原型链继承以及使用object.create 方案（所实话这种拷贝继承的我觉得也怪怪的

<img src="./pic/继承总结图.png"></img>



# 使用extends后的原型链

* 当需要extnes继承的时候,class lily(你可以理解为function liLy())的隐式原型会被指向到class people (你可以理解为function people())而不是传统的Function.prototype,那这样有什么作用呢，其实我觉得就是修正继承的显示而已

```js
  class People {
        constructor(name, age) {
            this.name = name;
            this.age = age;
        }
        say(){
            alert("yoo")
        }    
    }
    let test=new People("zz",'dd')
    console.log(test)

    class lily extends People{
        constructor(...arg){
            super(...arg)
        }
        happy(){
            alert('zggg')
        }
    }
    let test3=new lily('tt','yy')
    console.log(test3)

    function yoo(name,age){
        this.name=name
        this.age=age
    }
    yoo.prototype.say=function(){
        alert('ddd')
    }
    let test2=new yoo('haha','jiji')
    console.log(test2)
```

<img src="./pic/extend 的原型链图.png">



* 属性会给实例对象，方法会给上层原型身上

```js
	class People {
        constructor(name, age) {
            this.name = name;
            this.age = age;
        }
                test=22
        say(){
            alert("yoo")
        }    
    }
    let test=new People("zz",'dd')
    console.log(test)
```



# call、bind、apply

- 三者都可以改变函数的 this 对象指向
- 三者第一个参数都是 this 要指向的对象，如果如果没有这个参数或参数为 undefined 或 null，则默认指向全局 window
- 三者都可以传参，但是 apply 是数组，而call是参数列表，且 apply 和 call 是一次性传入参数，而 bind 可以分为多次传入

```js

 function foo() {
     console.log(this.value);
 };

 obj = {
     value: 10
 };
 obj1 = {
     value: 100
 };
 obj2 = {
     value: 1000
 };
 var p = foo.bind(obj).bind(obj1).bind(obj2);
 p();//10
```

多次绑定bind只是一直在改变this的指向，最终还是变回第一次绑定的this。所以bind多次绑定是无效，只有第一次有效果(从最右边往左看)

- bind 是返回绑定this之后的函数，apply、call 则是立即执行

# call 比apply 性能更优

- call 与apply 少两步解析过程，解析入参的数组



<img src="./pic/apply与call.png"></img>



测试代码：

```js
let arr = [10,12,123,432,54,67,678,98,342]; // 随便定义一些参数
function fn () {}

const name = 'call'
// const name = 'apply'
 
console.time(name);
for (let i = 0; i < 99999999; i++) {
  fn[name](this, ...arr) // call
  // fn[name](this, arr) // apply
}
console.timeEnd(name)

```



参考：

- [ecma](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-function.prototype.apply)
- [JS 探究之 call 和 apply 到底哪个快？](https://juejin.cn/post/7137959904135872549)

# sort
旧版使用[插入排序（长度＜=10）和快排](https://github.com/v8/v8/blob/ad82a40509c5b5b4680d4299c8f08d6c6d31af3c/src/js/array.js)，但是自es2019起规范要求使用稳定算法，所以
新版使用[timsort排序算法](https://github.com/v8/v8/blob/main/third_party/v8/builtins/array-sort.tq)，如果你要看js版本放进浏览器测试那看这个[答案](https://stackoverflow.com/questions/15606290/how-to-use-timsort-in-javascript)

- 按照32的长度进行分块，我们直接看32时是怎么处理的（大于的没看怎么分）

```js
 
        function binarySort(a, lo, hi, start, compare) {
            if (start == lo) start++;
            for (; start < hi; start++) {
                var pivot = a[start];

                // Set left (and right) to the index where a[start] (pivot) belongs
                var left = lo;
                var right = start;
                /*
                * Invariants: pivot >= all in [lo, left). pivot < all in [right, start).
                */
                while (left < right) {
				//这个会找偏后点的，比如1234找3，为什么，因为默认第一位算法已经排好序的了
                    var mid = (left + right) >>> 1;
                    if (compare(pivot, a[mid]) < 0)
                        right = mid;
                    else
                        left = mid + 1;
                }

                var n = start - left; // The number of elements to move
                // Switch is just an optimization for arraycopy in default case
                switch (n) {
                    case 2:
                        a[left + 2] = a[left + 1];
                    case 1:
                        a[left + 1] = a[left];
                        break;
                    default:
                        arraycopy(a, left, a, left + 1, n);
                }
                a[left] = pivot;
            }
        }


        function countRunAndMakeAscending(a, lo, hi, compare) {
            var runHi = lo + 1;

            // Find end of run, and reverse range if descending
            if (compare(a[runHi++], a[lo]) < 0) { // Descending
                while (runHi < hi && compare(a[runHi], a[runHi - 1]) < 0) {
                    runHi++;
                }
                reverseRange(a, lo, runHi);
            } else { // Ascending
                while (runHi < hi && compare(a[runHi], a[runHi - 1]) >= 0) {
                    runHi++;
                }
            }

            return runHi - lo;
        }


```

 `countRunAndMakeAscending`函数负责找最小的转折点，就是升序和降序的转折点，（如果我传的对比函数是升序）降序时要反转成升序。

- `countRunAndMakeAscending`返回的值肯定大于等于2（看了代码就知道为什么了
- `binarySort`就是常见的二分插入了

我认为以上这是一种优化了的二分插入算法



参考：

- [tim排序](https://oi-wiki.org/basic/tim-sort/)
- [js实现](https://github.com/Scipion/interesting-javascript-codes/blob/master/timsort.js)

# addEventListener
 - 构造函数
     addEventListener(type, listener);
     addEventListener(type, listener, options);
     addEventListener(type, listener, useCapture);Gecko

     addEventListener(type, listener, wantsUntrusted ); // Gecko渲染引擎(Mozilla) 

     ​

 - 参数

     **type** : 字符串，表示事件的类型，例如 `'click'`、`'mouseover'` 等。

     **listener**: 事件触发时执行的函数。

     **options**  ：对象可以包含以下属性：

     - **capture**: 布尔值，表示事件是否在捕获阶段执行。如果为 `true`，事件在捕获阶段触发；如果为 `false`，事件在冒泡阶段触发。
     - **once**: 布尔值，表示事件监听器是否只执行一次执行后自动移除。如果为 `true`，事件监听器在触发一次后自动被移除。
     - **passive**: 布尔值，表示事件监听器是否`不会调用 preventDefault`。如果为 `true`，监听器不会调用 `preventDefault`，这对于提升滚动性能非常有用。
     - **signal**: `AbortSignal` 对象，用于取消事件监听器。

     ```js
     const button = document.getElementById('myButton');
     const cancelButton = document.getElementById('cancelButton');
     const controller = new AbortController();
     const signal = controller.signal;

     // 定义事件处理函数
     function handleClick(event) {
         console.log('Button clicked');
     }

     // 添加事件监听器，使用 signal 属性
     button.addEventListener('click', handleClick, { signal: signal });

     // 取消事件监听器
     cancelButton.addEventListener('click', () => {
         controller.abort();
         console.log('Event listener cancelled');
     });

     ```

     ​

     **useCapture**: 布尔值，表示事件是否在捕获阶段执行。如果为 `true`，事件在捕获阶段触发；如果为 `false`，事件在冒泡阶段触发（默认）。

     **wantsUntrusted**: 可选的布尔值，用于指定是否接收未被信任的事件。默认为 `false`。

     > wantsUntrusted参数的目的是指定是否应该接收和处理未被信任的事件。在早期的浏览器实现中，可能会区分受信任的事件（例如，由用户直接触发的事件）和未受信任的事件（例如，由脚本触发的事件）true为监听器会接收未被信任的事件。false为监听器只会接收受信任的事件。




- ### option 支持的安全检测

```js
let passiveSupported = false;

try {
  const options = {
    get passive() {
      // 该函数会在浏览器尝试访问 passive 值时被调用。
      passiveSupported = true;
      return false;
    },
  };

  window.addEventListener("test", null, options);
  window.removeEventListener("test", null, options);
} catch (err) {
  passiveSupported = false;
}


someElement.addEventListener(
  "mouseup",
  handleMouseUp,
  passiveSupported ? { passive: true } : false,
);

```

* 通过 `passive` 优化性能

在处理滚动事件时，例如：

```

window.addEventListener('scroll', function(event) {
    // 可能调用 event.preventDefault()
});
```

浏览器必须等待监听器执行完成，以确定是否调用 `preventDefault`。这种等待会导致滚动和渲染的延迟，从而影响页面的流畅性和响应速度。



* 参考：[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener#%E8%AF%AD%E6%B3%95)



# 阻止事件冒泡和默认行为

- 代码

```js
//阻止事件冒泡
event.stopPropagation();

//阻止默认行为
event.preventDefault();

```



- HTML 元素的默认行为

1. `<a>` (锚点) 标签
   - 默认行为：导航到 `href` 属性指定的 URL。
2. `<form>` (表单) 标签
   - 默认行为：提交表单数据到 `action` 属性指定的 URL。
3. `<input>` 和 `<textarea>`
   - 默认行为：用户在输入字段中输入文本。
   - `<input type="checkbox">` 和 `<input type="radio">`：切换选中状态。
4. `<button>` 按钮
   - 默认行为：在表单中，点击按钮会提交表单（如果 `type="submit"`）。
5. `<select>` 元素
   - 默认行为：展开选项列表并允许用户选择选项。
6. `<video>` 和 `<audio>` 元素
   - 默认行为：播放媒体文件（当用户点击播放按钮时）。
7. `<img>` 标签
   - 默认行为：加载并显示图像。

- 常见事件的默认行为

1. **click 事件**
   - 默认行为：在可点击元素上触发相应的动作，例如，导航到链接，提交表单。
2. **submit 事件**
   - 默认行为：提交表单数据。
3. **keydown 和 keypress 事件**
   - 默认行为：在文本输入字段中插入字符，触发快捷键操作。
4. **wheel 事件**
   - 默认行为：滚动页面或滚动容器内容。
5. **contextmenu 事件**
   - 默认行为：打开右键菜单。
6. **touchstart 和 touchmove 事件**
   - 默认行为：触摸设备上的触摸滑动和滚动行为。
7. **mousedown 和 mouseup 事件**
   - 默认行为：更新元素的激活状态（例如，按钮按下和释放）。
8. **input 事件**
   - 默认行为：更新表单控件的值。
9. **dblclick 事件**
   - 默认行为：选择文本或触发双击操作。
10. **focus 和 blur 事件**
  - 默认行为：元素获得或失去焦点。
11. **dragstart 和 dragend 事件**
    - 默认行为：开始和结束拖动操作。

- 阻止默认行为的示例

你可以通过 `event.preventDefault()` 方法来阻止这些默认行为。这允许你自定义事件处理逻辑。例如：

```html

<!DOCTYPE html>
<html>
<head>
    <title>Prevent Default Example</title>
</head>
<body>
    <!-- 阻止链接的默认导航行为 -->
    <a href="https://www.example.com" onclick="event.preventDefault(); alert('Default behavior prevented');">Click me</a>

    <!-- 阻止表单的默认提交行为 -->
    <form action="/submit" method="POST" onsubmit="event.preventDefault(); alert('Form submission prevented');">
        <input type="text" name="name">
        <button type="submit">Submit</button>
    </form>

    <!-- 阻止滚动的默认行为 -->
    <div style="width: 200px; height: 200px; overflow: scroll;" onwheel="event.preventDefault(); alert('Scroll prevented');">
        <div style="height: 1000px;">Scrollable content</div>
    </div>

    <!-- 阻止文本输入的默认行为 -->
    <input type="text" onkeydown="event.preventDefault(); alert('Key down prevented');">

    <!-- 阻止右键菜单的默认行为 -->
    <div oncontextmenu="event.preventDefault(); alert('Context menu prevented');">Right-click me</div>

    <!-- 阻止触摸滑动的默认行为 -->
    <div style="width: 200px; height: 200px; overflow: scroll;" ontouchmove="event.preventDefault(); alert('Touch move prevented');">
        <div style="height: 1000px;">Scrollable content</div>
    </div>
</body>
</html>
```



# defer和async

<img src="./pic/defer和async.png"></img>

defer：脚本的加载是异步进行的，但是执行是按照它们在文档中的顺序进行的。换句话说，多个带有 defer 属性的脚本会按照它们在 HTML 中的顺序执行，且会在 DOMContentLoaded 事件之前执行。

   async：脚本的加载和执行都是异步的，不按照它们在文档中的顺序执行。脚本下载完毕后立即执行，不会阻塞 HTML 解析或其他脚本的加载和执行。



# instanceof 和 typeof

* 区别:

  * typeof 会返回一个变量的基本类型，instanceof 返回的是一个布尔值
  * instanceof 可以准确地判断复杂引用数据类型，但是不能正确判断基础数据类型
  * 而 typeof 也存在弊端，它虽然可以判断基础数据类型(null 除外)，但是引用数据类型中，除了 function 类型以外，其他的也无法判断

* typeof原理

  > 不同的对象在底层都表示为二进制，在Javascript中二进制前（低）三位存储其类型信息。
  >
  > - 000: 对象
  > - 010: 浮点数
  > - 100：字符串
  > - 110： 布尔
  > - 1： 整数
  >   typeof null 为"object", 原因是因为 不同的对象在底层都表示为二进制，在Javascript中二进制前（低）三位都为0的话会被判断为Object类型，null的二进制表示全为0，自然前三位也是0，所以执行typeof时会返回"object"。
  >   一个不恰当的例子，假设所有的Javascript对象都是16位的，也就是有16个0或1组成的序列，猜想如下：
  >
  > Array: 1000100010001000
  > null: 0000000000000000
  >
  > typeof [] // "object"
  > typeof null // "object"
  > 因为Array和null的前三位都是000。为什么Array的前三位不是100?因为二进制中的“前”一般代表低位， 比如二进制00000011对应十进制数是3，它的前三位是011。

  ​

* instanceof 实现原理

  ```js
  function myInstanceof(left, right) {
    // typeof false
    if(typeof left !== 'object' || left === null) return false;
    // getProtypeOf Object API
    let proto = Object.getPrototypeOf(left);
    while(true) {
        	if(proto === null) return false;
        	if(proto === right.prototype) return true;// true
        	proto = Object.getPrototypeof(proto);
        }
    
  }
  ```

  ​

参考：

- [2ality – JavaScript and more](https://2ality.com/2013/10/typeof-null.html)

# js 精度问题

- 前置

  - 科学计数法：`7.823E5 = 782300`这里`E5`表示10的5次方，再比如`54.3E-2 = 0.543`这里`E-2`表示10的-2次方

  - 十进制转二进制：整数除2余数逆序排列。小数部分乘2，直到小数部分为 0 或达到所需精度（存在无法精确表示的数，比如二进制中无法精确表示0.1）。

  - 在**二进制系统**中，只有那些能写成分母为2的幂次方的分数才能被精确表示，像0.1这样的数则会变成无限循环小数。在**十进制系统**中，只有那些能写成分母为10的幂次方的分数才能被精确表示，像1/3这样的数则会变成无限循环小数。以此类推。

  - 浮点型数据类型主要有：单精度`float`、双精度`double`。javascript以64位双精度浮点数存储所Number类型值 即计算机最多存储64位二进制数。

  - IEEE754标准下的单双精度存储对比

    <img src="./pic/单精度和双精度存储.png"></img>

  - 指数偏移量

    指数有正负之分，为了区分正负计算机可采用多种方案，其中IEEE 754采用的是偏移表示法。单精度下，8位指数位置可以表示 0 到 255，但是指数值 0 和 255 用于特殊用途，因此实际用于普通浮点数的有效指数范围是从 1 到 254。在十进制下，这对应于实际有效范围 [-126, 127]，共计 254 个不同的指数值。

  - 小数部分超出52位处理办法：

  > 在 IEEE 754 双精度浮点数中，舍入机制遵循“舍入到最近值（round to nearest, ties to even）”的规则。这意味着：
  >
  > 1. **当截断部分的首位是 0**：直接舍弃，不进位。
  > 2. 当截断部分的首位是 1：
  >    - 如果截断部分的其余位全为 0 或首位之后的位数与当前尾数位合起来是奇数（即尾数部分在舍入后的最后一位是 1），则进位。（0.1就是这样舍弃精度的
  >    - 如果截断部分的其余位全为 0 且尾数部分在舍入后的最后一位是 0，则舍弃。

  可以结合12345678901234567和123456789012345678去理解，他们小数部分都是超出了52位

- 如何转换存储的

  计算机存储一个27.5的数字 :

  - 首先把这个数字转换为二进制11011.1
  - 再把二进制转换为科学记数法 11011.1*2^4
  - 又因js存储数字用的是双精度浮点数【最多存储64位】 即 符号位【1】+指数位【4+1023(固定偏移量)=> 10000000011】+小数部分【10111(52位不够用0补齐)】
  - 即 0100 0000 0011 1011 1000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000

  那小数点前面的整数位不用存储吗？不用 因为转化为二进制之后首位数都是1 ,计算机会自动处理

- 总结

  计算机存储双精度浮点数需要先把十进制数转换为二进制的科学记数法的形式，然后计算机以自己的规则{符号位+(指数位+指数偏移量的二进制)+小数部分}存储二进制的科学记数法,因为存储时有位数限制（64位），并且某些十进制的浮点数在转换为二进制数时会出现无限循环，会造成二进制的舍入操作(0舍1入)，当再转换为十进制时就造成了计算误差，所以0.1+0.2==0.30000000000000004 ，而.30000000000000004 ！=0.3，就出现了0.1+0.2！=0.3

- 如何解决


  - 现成的类库Math.js、BigDecimal.js
  - bigint类型(只能用于整数，不适用于小数)
  - 先扩大处理小数再缩小的方式（扩大时可能还是有精度问题，可以结合Math.round取整，具体代码实现见下面的参考文章，但这文章的实现中其实过小的小数也不能这么处理，可能会因为扩大成整数时造成精度溢出，只适合一般项目中使用，除非替换成bigInt 处理扩大）

- 引发的周边思考与问题

  - 但你看到的 `0.1` 实际上并不是 `0.1`。

  ```js
  0.1.toPrecision(21)=0.100000000000000005551
  ```

  存储二进制时小数点的偏移量最大为52位，最多可表示的十进制为9007199254740992，对应科学计数尾数是 9.007199254740992，这也是 JS 最多能表示的精度。它的长度是 16，所以可以使用 toPrecision(16) 来做精度运算，js自动做了这一部分处理，超过的精度会自动做凑整处理。于是就有：

  ```
  0.10000000000000000555.toPrecision(16) //0.1000000000000000 去掉末尾的零后正好为0.1
  ```


  - tofixed()对于小数最后一位为5时进位不正确的问题

  浮点数很容易有精度问题，而tofixed()往往需要四舍五入，所以小数最后一位是5时进位问题就会变得是一个很明显的问题。比如1.005.toFixed(2) 返回的是 1.00 而不是 1.01。因为1.005实际上并不是1.005，js里面其实是1.00499999999999989

  ```js
  1.005.toPrecision(21) //1.00499999999999989342
  1.00499999999999989342==1.005//true
  ```

  如何修复这个问题，一种是最后一位为5的，改成6，再调用toFixed,另一种是先扩大再缩小法（保留一位小数+0.5再缩小回去） ，具体代码可以看下面的参考文章,这里不罗列了

  - 误差检查函数（出自《ES6标准入门》-阮一峰）

  ```js
  function withinErrorMargin (left, right) {
      return Math.abs(left - right) < Number.EPSILON
  }
  withinErrorMargin(0.1+0.2, 0.3)

  ```

  - 选择 12 做为默认精度

  是一个经验的选择，一般选12就能解决掉大部分0001和0009问题(`0.0001` 在二进制中无法精确表示，只能近似表示。`0.0009` 也是类似。)，而且大部分情况下也够用了，如果你需要更精确可以调高。比如：当你拿到 1.4000000000000001 这样的数据要展示时，建议使用 toPrecision 凑整并 parseFloat 转成数字后再显示，如下

  ```js
  parseFloat(1.4000000000000001.toPrecision(12)) === 1.4  // true

  ```

- 0.1的ieee754标准下是失精的，为什么乘10 变成1 就正常，但是35.41*10却还是不准确？

搞懂这背后的计算原理就知道为什么了。0.1的二进制表示`0.00011001100110011001100110011001100110011001100110011010`

1为`1010`，相乘的话最终结果本质上相当于左移1位和左移3位的相加，得到1.00000...00100又因为尾数位过长，舍弃最后三位就刚好为1（套用上面的舍弃规则，不需要进位）。

- $ \textcolor{red}{既然17位的有效数字已经可能存在失精度，那为什么toPrecision参数可以设置到最大100}$

  问了gpt,但暂时没找到能现在理解并且有参考引用的答案




参考：

- [为什么偏移量是1023](https://segmentfault.com/q/1010000016401244/a-1020000016446375)

- [js精度丢失问题-看这篇文章就够了(通俗易懂)](https://zhuanlan.zhihu.com/p/100353781)

  ​

  ​

  # DOM 事件模型

- 事件模型

  - 原始事件模型（DOM0级）
  - 标准事件模型（DOM2级）
  - IE事件模型

- 原始事件模型

  只支持冒泡，不支持捕获;同一个类型的事件只能绑定一次(后绑会覆盖前绑)

  - HTML直接绑定
  - JS直接绑定

- 标准事件绑定

  事件捕获->事件处理->事件冒泡

  - addEventListener和.removeEventListener（eventType 没有on,其他两个需要on）

- IE事件模型

  事件处理->事件冒泡

  - attachEvent和detachEvent

  ​