function hanoiMain(mode,rel){
	this.version='0.92';
	this.mode=typeof mode!=='undefined'?mode:'asc';
	rel=typeof rel!=='undefined'?rel:'../';
	w=500;
	h=300;
	this.clrs=[["PaleGreen",'#98FB98'],["SpringGreen",'#00FF7F'],["Yellow",'#FFFF00'],["Gold",'#FFD700'],["Thistle",'#D8BFD8'],["Pink",'#FFC0CB'],["LightSalmon",'#FFA07A'],["Lime",'#00FF00'],["DarkSeaGreen",'#8FBC8F'],["Orange",'#FFA500'],["Khaki",'#F0E68C'],["Violet",'#EE82EE'],["Teal",'#008080'],["LightBlue",'#ADD8E6'],["SkyBlue",'#87CEEB'],["Blue",'#0000FF'],["Navy",'#000080'],["Purple",'#800080'],["Wheat",'#F5DEB3'],["Tan",'#D2B48C'],["AntiqueWhite",["SlateBlue",'#6A5ACD'],'#FAEBD7'],["Aquamarine",'#7FFFD4'],["Silver",'#C0C0C0']];
	startX=50;
	shapeNum=5;
	var s="";
	s+='<div style="position:relative; width:'+ w+'px; height:'+ h+'px;  margin:auto; display:block; border: none;  border-radius: 10px; box-shadow: 0px 0px 19px 10px rgba(0,0,68,0.46); ">';
	s+='<div id="btns0" style="position:absolute; left:15px; top:3px;">';
	s+='<span style="font: 18px Arial; text-align: center; color: black;">Ringen: </span>';
	s+='<span id="num" style="text-align: center; padding: 2px 20px 2px 20px; font: 24px Arial; color: black; background-color: #00bfff ">3</span>';
	s+='<button id="dnBtn" style="font-size: 16px; color: #000aae; " class="togglebtn"  onclick="numDn()" >minder</button>';
	s+='<button id="upBtn" style="font-size: 16px; color: #000aae; " class="togglebtn"  onclick="numUp()" >meer</button>';
	s+='<span id="moves" style="text-align: center; margin-left: 25px; font: bold 20px Arial; color: darkblue; ">Beurten: 0</span>';
	s+='<button id="restart" style="margin-left: 25px; font-size: 15px; color: #000aae; " class="togglebtn"  onclick="newGame()" >Opnieuw</button>';
	s+='<button id="solve" style="margin-left: 10px; font-size: 15px; color: #000aae; display:none;" class="togglebtn" onclick="solveIt()" >Solve!</button>';
	s+='</div>';
	s+='<div id="success" style="position:absolute; left:0; top:40px; width:'+ w+'px; font: bold 36px Arial; text-align: center; color: gold;">Yeah let\'s go!</div>';
	s+='<canvas id="canvasId" width="'+ w+'" height="'+ h+'" style="z-index:2;"></canvas>';
	s+='<div id="info" style="position:absolute; right:20px; bottom:5px; margin-left: 30px; font: 16px Arial; text-align: center; color: black;display:none;">Minimum Moves: 7</div>';
	s+='<div id="copyrt" style="position:absolute; left:3px; bottom:3px; font: 10px Arial; font-weight: bold; color: blue; ">2022 v1.0</div>';
	s+='</div>';
	document.write(s);
	el=document.getElementById('canvasId');
	ratio=2;
	el.width=w*ratio;
	el.height=h*ratio;
	el.style.width=w+"px";
	el.style.height=h+"px";
	g=el.getContext("2d");
	g.setTransform(ratio,0,0,ratio,0,0);
	shapes=[];
	dragging=false;
	dragIndex=-1;
	dragHoldX=0;
	dragHoldY=0;
	poleStt=90;
	poleWd=160;
	poleY=240;
	diskH=32;
	this.poles=[];
	this.moveN=0;
	this.diskTot=3;
	newGame();
	el.addEventListener("mousedown",mouseDownListener,false);
	el.addEventListener('touchstart',ontouchstart,false);
	el.addEventListener("mousemove",dopointer,false);
}

function getNum(){return this.diskTot;}
function numDn(){var num=getNum();if(num>3){num--;chgNumPts(num);}}
function numUp(){var num=getNum();if(num<6){num++;chgNumPts(num);}}
function chgNumPts(n){document.getElementById('num').innerHTML=n;this.diskTot=n;newGame();}
function drawPoles(){for(var i=0;i<this.poles.length;i++){drawPole(poleStt+ i*poleWd,poleY);}}
function drawPole(x,y){var wd=150;var ht=140;g.lineWidth=1;g.strokeStyle="black";g.fillStyle="#d43";g.beginPath();g.roundRect(x- 3,y- ht,6,ht,6,3);g.roundRect(x- wd/2,y- 3,wd,8,4);g.closePath();g.stroke();g.fill();}
function newGame(){chgMoveN(0);stopAnim();var p0=[];for(var i=diskTot- 1;i>=0;i--){p0.push(i);}
this.poles=[p0,[],[]];shapes=[];poles2Shapes();drawShapes();testSuccess();document.getElementById('info').innerHTML='Minimum Moves: '+((1<<diskTot)- 1).toString();}
function ontouchstart(evt){var touch=evt.targetTouches[0];evt.clientX=touch.clientX;evt.clientY=touch.clientY;evt.touchQ=true;mouseDownListener(evt)}
function ontouchmove(evt){var touch=evt.targetTouches[0];evt.clientX=touch.clientX;evt.clientY=touch.clientY;evt.touchQ=true;mouseMoveListener(evt);evt.preventDefault();}
function ontouchend(evt){el.addEventListener('touchstart',ontouchstart,false);window.removeEventListener("touchend",ontouchend,false);if(dragging){dragging=false;shapes[dragIndex].shadowQ=false;doDrop(dragIndex);dragIndex=-1;drawShapes();window.removeEventListener("touchmove",ontouchmove,false);}}
function dopointer(e){var bRect=el.getBoundingClientRect();var mouseX=(e.clientX- bRect.left)*(el.width/ratio/bRect.width);var mouseY=(e.clientY- bRect.top)*(el.height/ratio/bRect.height);var inQ=false;for(var i=0;i<shapes.length;i++){if(hitTest(shapes[i],mouseX,mouseY)){if(topDiskQ(i)){inQ=true;}}}
if(inQ){document.body.style.cursor="pointer";}else{document.body.style.cursor="default";}}
function mouseDownListener(evt){var i;var highestIndex=-1;var bRect=el.getBoundingClientRect();var mouseX=(evt.clientX- bRect.left)*(el.width/ratio/bRect.width);var mouseY=(evt.clientY- bRect.top)*(el.height/ratio/bRect.height);for(i=0;i<shapes.length;i++){if(hitTest(shapes[i],mouseX,mouseY)){if(topDiskQ(i)){dragging=true;if(i>highestIndex){dragHoldX=mouseX- shapes[i].x;dragHoldY=mouseY- shapes[i].y;highestIndex=i;dragIndex=i;}}}}
if(dragging){if(evt.touchQ){window.addEventListener('touchmove',ontouchmove,false);}else{window.addEventListener("mousemove",mouseMoveListener,false);}}
if(evt.touchQ){el.removeEventListener("touchstart",ontouchstart,false);window.addEventListener("touchend",ontouchend,false);}else{el.removeEventListener("mousedown",mouseDownListener,false);window.addEventListener("mouseup",mouseUpListener,false);}
if(evt.preventDefault){evt.preventDefault();}
else if(evt.returnValue){evt.returnValue=false;}
return false;}
function mouseUpListener(evt){el.addEventListener("mousedown",mouseDownListener,false);window.removeEventListener("mouseup",mouseUpListener,false);if(dragging){dragging=false;shapes[dragIndex].shadowQ=false;doDrop(dragIndex);dragIndex=-1;drawShapes();window.removeEventListener("mousemove",mouseMoveListener,false);}}
function mouseMoveListener(evt){if(dragIndex<0)return;var bRect=el.getBoundingClientRect();var mouseX=(evt.clientX- bRect.left)*(el.width/ratio/bRect.width);var mouseY=(evt.clientY- bRect.top)*(el.height/ratio/bRect.height);var posX=mouseX- dragHoldX;var posY=mouseY- dragHoldY;shapes[dragIndex].x=posX;shapes[dragIndex].y=posY;drawShapes(dragIndex);}
function topDiskQ(n){for(i=0;i<this.poles.length;i++){var pole=this.poles[i];if(pole.length>0){if(n==pole[pole.length- 1])return true;}}
return false;}
function hitTest(shape,mx,my){if(mx<shape.x)return false;if(my<shape.y)return false;if(mx>(shape.x+ shape.wd))return false;if(my>(shape.y+ shape.ht))return false;return true;}
function makeShapes(){shapes=[];var left=startX;for(var i=0;i<this.poles.length;i++){var pole=this.poles[i];for(var j=0;j<pole.length;j++){var d=pole[j];var shp={x:i*100+ left- d*10,y:poleY- j*20,wd:20+ d*20,ht:20,pole:i,shadowQ:false};shapes.push(shp);}}}
function doDrop(dropNo){var shp=shapes[dropNo];var p=Math.round((shp.x- poleStt)/ poleWd);
p=Math.max(0,Math.min(p,2));if(p!=shp.pole){var okQ=false;var pole=this.poles[p];if(pole.length==0){okQ=true;}else{var top=pole[pole.length- 1];if(dropNo<top)okQ=true;}
if(okQ){chgMoveN(1);shp.pole=p;this.poles=[[],[],[]];for(var i=0;i<shapes.length;i++){shp=shapes[i];this.poles[shp.pole].unshift(i);}}}
poles2Shapes();testSuccess();}
function testSuccess(){if(isSuccess()){document.getElementById('success').innerHTML="Yeah let's go!";}else{document.getElementById('success').innerHTML="";}}
function isSuccess(){var p2=this.poles[2];if(p2.length!=diskTot)return false;for(var i=0;i<diskTot;i++){var n=diskTot- i- 1;if(p2[i]!=n)return false;}
return true;}
function chgMoveN(n){if(n==1){this.moveN++;}else{this.moveN=0;}
document.getElementById('moves').innerHTML='Beurten: '+ this.moveN;}
function poles2Shapes(){for(var i=0;i<this.poles.length;i++){var pole=this.poles[i];for(var j=0;j<pole.length;j++){var d=pole[j];var w=30+ d*20;if(d!=dragIndex)
shapes[d]={x:poleStt+ i*poleWd- w/2,y:poleY- j*diskH- diskH- 3,wd:w,ht:diskH,pole:i,shadowQ:false};}}}
function drawShapes(moveNo){moveNo=typeof moveNo!=='undefined'?moveNo:-1;poles2Shapes();g=el.getContext("2d");g.clearRect(0,0,el.width,el.height);drawPoles();g.lineWidth=1;g.strokeStyle="#aaaaaa";for(var i=0;i<shapes.length;i++){if(moveNo==i){g.lineWidth=2;g.strokeStyle="rgba(111, 111, 0, 1)";}else{g.lineWidth=1;g.strokeStyle="rgba(111, 111, 0, 1)";}
g.fillStyle=this.clrs[i][1];g.beginPath();g.roundRect(shapes[i].x,shapes[i].y,shapes[i].wd,shapes[i].ht,10);g.closePath();g.stroke();g.fill();}}
function solveIt(){newGame();moves=[];hanoi(0,2,1,this.diskTot);var p0=[];for(var i=diskTot- 1;i>=0;i--){p0.push(i);}
this.poles=[p0,[],[]];frame=0;moveNo=0;solveAnim();}
function stopAnim(){moveNo=moves.length+ 1;}
function solveAnim(){if(moveNo>moves.length)return;frame++;if(frame>20){frame=0;var move=moves[moveNo];pFr=this.poles[move[0]];pTo=this.poles[move[1]];pTo.push(pFr.pop());poles2Shapes();drawShapes();moveNo++;}
if(moveNo<moves.length)requestAnimationFrame(solveAnim);}
function hanoi(from,to,buf,nmv){if(nmv>1){hanoi(from,buf,to,nmv- 1);moves.push([from,to]);hanoi(buf,to,from,nmv- 1);}
else{moves.push([from,to]);}}
CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){if(w<2*r)r=w/2;if(h<2*r)r=h/2;this.moveTo(x+ r,y);this.arcTo(x+ w,y,x+ w,y+ h,r);this.arcTo(x+ w,y+ h,x,y+ h,r);this.arcTo(x,y+ h,x,y,r);this.arcTo(x,y,x+ w,y,r);return this;};

hanoiMain();