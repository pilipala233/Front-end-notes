# 配置
- compilerOptions
    - targrt: //配置编译目标代码的版本标准,如果不配置默认为es3，如果配置es7以上版本，应该写标准写法
    - module: //配置编译模块的标准
    - lib: //配置编译时需要引入的库文件，如果要使用node,那么需要安装node的声明文件
    - strictnullChecks: //配置是否开启严格的null检查,null和undefined只能赋值给自己和void
    - noEmitOnError: //配置是否在编译出错时终止编译
    - esModuleInterop: //配置是否允许编译时使用es6模块系统
    - removeComments: //配置是否移除注释
    
    - moduleResolution: //配置模块解析策略
    - noImplicitUseStrict: //配置是否在编译时生成"use strict"
    - strictpropertyInitialization: //配置是否严格检查类的属性是否初始化
 - 使用了配置文件后，使用tsc进行编译时，不能跟上文件名，如果跟上文件名，会忽略配置文件。比如刚开始安装时，使用tsc index.ts。配置了tsconfig.json后，就是使用全局tsc命令进行编译
 - include: //配置需要编译的文件夹
 - files: //配置需要编译的文件(单个文件)，涉及它本身以及所依赖的文件
 - outDir: //配置输出文件夹

 # 基本类型
  - number
  - string
  - boolean
  - 数组
  ```ts
    let nums:number[]
    let nums:Array<number>=[3,2,5]//两种写法
  ```
  - object
  - null和undefined是所有类型的子类型，可以赋值给任意类型
  
  # 其他常用类型
  - 联合类型
  ```ts
    let value:string|number
    value='abc'
    value=123
  ```
  用的时候用typeof判断类型（类型保护的一种，但是只能触发基本类型）

- void类型:通常用于函数的返回值
- never类型：通常用于函数的返回值，表示函数永远不会返回结果（抛出错误或者死循环）
- 字面量类型：表示一个具体的值来约束变量,一种强类型约束
```ts
let a:'A'//只能赋值A

let user:{
    name:string,
    age:number
}
```
- 元祖类型（Tuple）：一个固定长度的数组，数组中每一项的类型都是固定的
```ts
let tuple:[string,number]
tuple=['a',1]
```

- any类型：可以绕过类型检查，赋值给任意类型

## 类型别名
字面量类型的提取版本(编译结果是不存在的)
```ts
let user:{
    name:string,
    age:number
}
functioon getUsers():{
    name:string,
    age:number
}[]{
    return []
}


type User={
    name:string,
    age:number
}
let user:User[]{
    return []
}
```
多个类型的联合
```ts
type Gender='男'|'女'
type User={
    name:string,
    age:number，
    gender:Gender
}

```
# 函数的相关约束
- 函数中存在throw new Error()时，已存在的返回值类型会被忽略，返回值类型会被推断为never
- 函数重载：函数名相同，参数个数或者类型不同，返回值类型不同
```ts
function combine(a:number,b:number):number//重载1
function combine(a:string,b:string):string//重载2
//具体函数体
function combine(a:number|string,b:number|string):number|string{
    if(typeof a==='number'&&typeof b==='number'){
        return a+b
    }else if(typeof a==='string'&&typeof b==='string'){
        return a+b
    }
    throw new Error('a和b必须是相同的类型')
}
```
- 函数可选参数：在参数后面加上?，表示可选参数，可选参数必须在必选参数后面
```ts
function sum(a:number,b?:number):number{
    return a+(b||0)
}
```
- 函数默认参数：在参数后面加上=，表示默认参数，可以不传
```ts
function sum(a:number,b:number=0):number{
    return a+b
}
```
# 枚举
- 枚举通常用于约束某一种取值范围
## 优势
- 字面量和联合类型也能到达相同的效果（会产生重复代码，没办法提取复用，但是也可以用类型别名处理）
- 类型别名结合字面量和联合类型使用，当需要修改时，所有代码都要替换(逻辑含义和真实值混在一起)
```ts
//当这里发生修改时，所有代码都要替换
type Gender='男'|'女'
let gender:Gender

gender = "男"

gender = "女"

function getUser(g:Gender)
```
- 枚举类型编译后还是存在的,所以代码里面的Gender.male和Gender.female是真实存在的

## 使用
- 字符串的枚举
```ts
enum Gender{
    male = "男"
    female = "女"
}

gender = Gender.male
gender = Gender.female
```
-  数字的枚举
- 默认情况下，枚举的值是从0开始的自动自增，也可以手动指定
- 编译结果和字符串不一样
```ts
enum Level{
    level1 = 1,
    level2 ,
    level3
}
let level:Level = Level.level1
//虽然合法，但是可能会导致一些问题（不建议）
let level:Level = 1
level = 2

``` 
## 最佳实践
- 不要字符串和数字混用
- 尽量使用枚举逻辑含义
- 数字枚举可以应用于基于位运算的权限控制
```ts   
enum Permission{
    Read = 1,
    Write = 2,
    Create = 4,
    Delete = 8
}
let p:Permission = Permission.Read|Permission.Write
if(p&Permission.Read){
    //有读的权限
}
if(p&Permission.Write){
    //有写的权限
}
//删除写的权限
p = p^Permission.Write
```
 
 # 模块化
 - 建议不要使用默认导出，没办法提供代码提示
 - 文件不要加 .ts后缀
 - es变CJS时，导出的声明会变成exports 对象的属性，其中特别的是默认导出会变成exports的default属性,所以在ts中引入时，import {fs} form "fs"反而是对的（和js相反），或者import * as fs from "fs"，这种方式ts和js都可以使用
 
 ## 如何在ts中使用node的模块
 - 直接使用，但是没办法提供代码提示
 - defalt导出用上面提到的方式
 - 下面的配置与写法
 ```ts

//tsconfig.json
 {
     "compilerOptions":{
        
         "esModuleInterop":true
     }
 }
 import myModule from './myModule'
 //ts中兼容写法
 export = {
    name:'zf',
    age:10

 }
 ```
 - ```import myModule require('./myModule')```
 # 接口和类型兼容性
- 以下使用类型别名都可以实现
```ts
//约束对象
interface User{
    name:string
    age:number
    say():void //es6的写法
    sayHello:()=> void
}
let user:User
let obj={
    name:'zf',
    age:10,
    say(){
        console.log('say')
    },
    sayHello(){
        console.log('sayHello')
    }
}
user=obj

//约束函数
type Condition=(n:number)=>boolean
//两个大括号没有成员名称，表示只是一个定界符，所以type 也可以这么写
type Condition= {
    (n:number):boolean
}

interface Condition{
    (n:number):boolean
}
function sum(numbers:number[],callBack){
    if(callBack(n)){
        s+=n
    }
}
sum([1,2,3],(n)=>n%2!==0)
```

- 接口可以继承
```ts
interface Speak{
    speak():void
}
interface Run{
    run():void
}
interface SpeakAndRun extends Speak,Run{
    jump():void
}
let person:SpeakAndRun={
    speak(){
        console.log('speak')
    },
    run(){
        console.log('run')
    },
    jump(){
        console.log('jump')
    }
}
//交叉类型
type A = {
    a:number
}
type B = {
    b:number
}
type C = {
    c:number
}A&B
```
注意：子接口不可以重复定义，类型别名可以（比如number&string,但是这样融合出来的新类型很诡异）

- readonly修饰符
```ts   
interface User{
    readonly id:number
    //这样就可以完全只读的属性数组
    readonly arr:readonly number[]
    name:string
}
let user:User={
    id:1,
    name:'zf'
}
user.id=2//报错
//变量是可以被重新赋值的，只是不能修改属性
let arr:readonly number[]=[1,2,3]
//等价于
let arr:ReadonlyArray<number>=[1,2,3]
arr[0]=2//报错




```
- 接口的兼容性
- 对象类型（所以给接口定义时是不需要全部定义返回字段的）
```ts
interface Duck{
    sound():'嘎嘎嘎'
    swin():void

}
let person={
    name:'伪装成鸭子的人',
 
    sound(){
        //将自动推断string断言为嘎嘎嘎，不然会报错
        return '嘎嘎嘎' as '嘎嘎嘎'
    },
    swin(){
        console.log('swin')
    }
}
let duck:Duck=person
```
- 当使用对象字面量时，ts会进行额外的检查，如果多了字段，会报错(因为间接赋值其实开发者未必能控制，但是你直接赋值肯定是可以控制的，所以多了肯定就报错了)
```ts

let duck:Duck={
    sound(){
        return '嘎嘎嘎' as '嘎嘎嘎'
    },
    swin(){
        console.log('swin')
    },
    //多了字段
    name:'伪装成鸭子的人'
}

```

- 函数类型
    - 参数(逆变：基类替换子类)：接口函数入参可以少（以forEach 参数类型实现为例子
    - 返回值（协变：子类替换基类）： 有返回值时要求返回值类型必须一致；没有返回值时（void），返回值类型可以不一致

# 类
- 属性应该写在类里面，不应该写在构造函数里面,
实例化后，不能给类的属性赋值，只能给构造函数的属性赋值
```ts
class Person{
    name:string
    age:number
    constructor(name:string,age:number){
        this.name=name
        this.age=age
    }
}
```
-  属性设置默认值
```ts
class Person{
    name:string='zf'
    age:number=10
    constructor(name:string,age:number){
        this.name=name
        this.age=age
    }
}
//等价于
class Person{
    name:string
    age:number
    constructor(name:string='zf',age:number=10){
        this.name=name
        this.age=age
    }
}
``` 
- 属性设置可选
```ts
class Person{
    name?:string
    age?:number
    constructor(name?:string,age?:number){
        this.name=name
        this.age=age
    }
}
//等价于
class Person{
    name:string|undefined
    age:number|undefined
    constructor(name?:string,age?:number){
        this.name=name
        this.age=age
    }
}
```
- readonly修饰符
```ts
class Person{
    readonly id:number
    name:string
    constructor(id:number,name:string){
        //只能在构造函数中赋值
        this.id=id
        this.name=name
    }
}
let p=new Person(1,'zf')
p.id=2//报错
```
- 访问修饰符（可以用在属性或者方法）
    - public:默认的访问修饰符，所有地方都可以访问
    - private:只能在类的内部访问
    - protected:只能在类的内部和子类中访问
- 构造器参数的简化写法
如果某个属性，通过构造函数的参数传递，并且不做任何处理的赋值给该属性，可以进行简写
```ts
class Person{
    constructor(public name:string,public age:number){
    }
}
//等价于
class Person{
    name:string
    age:number
    constructor(name:string,age:number){
        this.name=name
        this.age=age
    }
}
```
- 访问器
```ts
class Person{
    
    constructor(private _name:string){}
    get name(){
        return this._name
    }
    //如果不设置set方法，属性就是只读的
    set name(name:string){
        this._name=name
    }
}

# 泛型
- 一般用法
```ts
function createArray<T>(length:number,value:T):T[]{
    let result:T[]=[]
    for(let i=0;i<length;i++){
        result[i]=value
    }
    return result
}
let arr=createArray<string>(3,'x')
//类型推断
let arr=createArray(3,'x')

```

- 泛型默认值

```ts
function createArray<T=string>(length:number,value:T):T[]{
    let result:T[]=[]
    for(let i=0;i<length;i++){
        result[i]=value
    }
    return result
}
let arr=createArray(3,'x')
```
