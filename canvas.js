var Simulator = (function () {
	var NUM_OF_CELLS = 50;
	var canvas, cw, ch, ctx, cells = [], start = Date.now(), progress, timestamp, simulation;
	var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

	var init = function (canvasId) {
		canvas = document.getElementById(canvasId);  
		ctx = canvas.getContext("2d"); 
		cw = canvas.width;
		ch = canvas.height;
		start = Date.now();
		simulation = new Simulation(ctx);
		simulation.start();
	};

	var Cell = function (initials) {
		this.init(initials);
	};

	Cell.prototype = {

			CONSTANTS: {
				CELL_ALIVE: "alive",
				CELL_DEAD: "dead",
				CELL_NEXT_PHASE: "next phase",
				LIFECYCLE_BIRTH: "birth",
				LIFECYCLE_DEAD: "death",
				LIFECYCLE_PHASE_END: "death"
			},

			init: function (initials) {

				//initialize pseudo private properties from initializer params
				for (var k in initials) {
					this["_" + k] = initials[k] | 0;
				}
				
				//precalculate and cache some values for better performance
				this._br 			= this._r;
				this._color 		= ColorUtils.toRGBA(initials.c);
				this._glowColor  	= ColorUtils.toRGBA(ColorUtils.darken (initials.c,1));
				this._strokeColor  	= ColorUtils.toRGBA(ColorUtils.lighten (initials.c,1));

				//init lifespan
				this.initLifespan();

				//listeners
				this._listeners = [];

				//no life events yet
				this._lifeticker = 0;
			},

			
			/**
			 * barebone subscribe pattern. Improve when needed
			 * simply register a callback, no type, no bells'n whistles.
			 * handlers will get called for any type of event.
			 */
			subscribe: function (handlerFunction) {
				this._listeners.push(handlerFunction);
			},

			dispatchEvent: function (key, val) {
				var that = this;
				this._listeners.forEach(function (listener) {
					listener.call(null, that._id, key, val);
				});
			},

			/**
			 * Lifecycle
			 */

			 initLifespan: function () {

				this._lifespans = [];
				this._phasePtr = 0;

				this._lifespans[this._phasePtr++] 	= {cycles: Utils.getRndInt(5, 10), updateFunction: this.updateGrowing, drawFunction: this.drawGrown};
				this._lifespans[this._phasePtr++]	= {cycles: Utils.getRndInt(10, 75), updateFunction: this.updateGrown, drawFunction: this.drawGrown};
				this._lifespans[this._phasePtr++] 	= {cycles: Utils.getRndInt(10, 75), updateFunction: this.updateGrown, drawFunction: this.drawGrown};
				this._lifespans[this._phasePtr++] 	= {cycles: Utils.getRndInt(5, 10), updateFunction: this.updatePostMortem, drawFunction: this.drawPostMortem};

				this._phasePtr = 0;
			},

			nextPhase: function () {
				this._lifeticker = 0;
				if (this._phasePtr >= this._lifespans.length) {
					this._phasePtr = 0;
				}
				this._currentLifespanPhase = this._lifespans[this._phasePtr++];
				this.growPhase 	= this._currentLifespanPhase.updateFunction; 
				this.drawPhase 	= this._currentLifespanPhase.drawFunction;
			},

			birth: function () {
				this._alive = true;
				this.nextPhase();
				this.dispatchEvent(this.CONSTANTS.LIFECYCLE_BIRTH,this.CONSTANTS.CELL_ALIVE);
			},

			growing: function () {

			},

			grown: function () {

			},

			death: function () {
				this._alive = false;
				this.dispatchEvent(this.CONSTANTS.LIFECYCLE_DEAD, this.CONSTANTS.CELL_DEAD);
			},

			postMortem: function () {

			},

			//the update function will be replaced based on the phase in the lifecycle
			update: function () {
				this._lifeticker++;
				this.growPhase();
				this.drawPhase();
				this.checkForNextPhase();
			},

			checkForNextPhase: function () {
				if (this._lifeticker > this._currentLifespanPhase.cycles) {
					this.nextPhase();
					this.dispatchEvent(this.CONSTANTS.LIFECYCLE_PHASE_END, this.CONSTANTS.CELL_NEXT_PHASE);
				}
			},

			/*
			 * Grow nad draw will be overriden by functions 
			 * depending on the current lifespan phase of this cell
			 */
			growPhase: function () {},

			drawPhase: function () {},

			updateGrowing: function () {
				if (this._alive) {
					this._x += this._vx | 0;
					this._y += this._vy | 0;
					this._r =  (this._br * (this._lifeticker / this._currentLifespanPhase.cycles)) | 0;

					this.applyConstraints();
				}
			},

			updateGrown: function () {
				if (this._alive) {
					var rnd = Math.random();
					this._x += ((rnd * 4 - 2) + this._vx) | 0;
					this._y += ((rnd * 4 - 2) + this._vy) | 0;
					this._r =  Math.max (0, (this._br + rnd * 2 - 1)) | 0;

					this.applyConstraints();
				}
			},

			updatePostMortem: function () {
				this._r = Math.max (0, (this._br - this._br * (this._lifeticker / this._currentLifespanPhase.cycles))) | 0;
			},

			drawGrown: function () {
				//ctx.save();
				ctx.fillStyle = this._color;
				ctx.beginPath();

				//shadow for background
				ctx.shadowColor = "#ffffff";
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
				ctx.shadowBlur = 7;
				ctx.arc(this._x, this._y, 1.618 * this._r, 0, 360);
				ctx.fill();

				//no shadow
				ctx.shadowColor = "rgba(0,0,0,0)";
				ctx.fillStyle = this._glowColor;
				ctx.lineWidth = 2;
				ctx.strokeStyle = this._strokeColor;
				ctx.beginPath();
				ctx.arc(this._x, this._y, this._r, 0, 360);
				ctx.fill();
				ctx.stroke();
				//ctx.restore();
			},

			drawPostMortem: function () {
				ctx.beginPath();
				ctx.arc(this._x, this._y, 1.618 * this._r, 0, 360);
				ctx.stroke();
			},

			applyConstraints: function () {
				if (this._x <= 0 || this._x >= cw) {
						this._vx *= -1; 
					};

				if (this._y <= 0 || this._y >= ch) {
					this._vy *= -1;
				};
			},
	};

	var CellPool = (function () {

		var NUM_OF_CELLS = 0,
			ID = 0;
		var _pool = [];

		var createCell = function () {

			var initials = {
				id: ID++,
				x: Math.random() * cw,
				y:  Math.random() * ch,
				vx: Math.random() * 4 - 2,
				vy: Math.random() * 4 - 2,
				r: 10,
				c: ColorUtils.random()
			}
			var c = new Cell(initials);
			c.ctx = ctx;
			c.subscribe(cellLifecycleHandler);
			c.birth();
			return c;
		};

		var cellLifecycleHandler = function (id, key, value) {
			console.log ("cellLifecycleHandler -> ID: " + id + ", key: " + key + ", value: " + value);
		}

		var createCells = function (numOfCells) {
			NUM_OF_CELLS = numOfCells;
			for (var i = 0; i < numOfCells; i++) {
				_pool[i] = c = createCell();
				c.update();
			};
		}

		return {
			init: function (numOfCells) {
				//create cells
				createCells(numOfCells);
			},

			getCells: function () {
				return _pool;
			}
		}
	})();	

	var Simulation = function (ctx) {
		this.init(ctx);
	};

	Simulation.prototype = {

		init: function (ctx) {
			CellPool.init(50);
			this._running = false;
			this._ctx = ctx;
		},

		clearCanvas: function () {
			this._ctx.save();
			this._ctx.setTransform(1, 0, 0, 1, 0, 0);
			this._ctx.clearRect(0, 0, cw, ch);
			this._ctx.restore();
		},

		start: function () {
			this._running = true;
			requestAnimationFrame(this.step);
		},

		stop: function () {
			this._running = false;
		},

		updateAndDrawCells: function () {
			
			var cells = CellPool.getCells();

			for (var i = 0, n = cells.length; i < n; i++) {
				cells[i].update();
			};
		},

		step: function (timestamp) {
			now = Date.now();

			simulation.clearCanvas();
			simulation.updateAndDrawCells();

		  	var progress =  now - start;
		  	//TODO: Fix: reference to simulation, step is called form window
		    requestAnimationFrame(simulation.step);
		}
	};
	
	return {
		setup: function (canvasId) {
			init(canvasId);
		},

		test: function (canvasId) {
			init(canvasId);
		}
	};
}());

var Utils = (function () {
	return {
		getRndInt: function (min, max) {
			return Math.random() * max + min;
		}
	};
})();

var ColorUtils = function () {
	return {
		adjust: function (f, c, a) {
			//var pc = parseInt (c.replace("#", "0x"), 16);
			//var r = c.red >> 16 & 0xff,
      		//	g = c.green >> 8 & 0xff,
      		//	b = c.blue & 0xff;
      		return {red: Math.min(255, (f * c.red) | 0), green: Math.min (255, (f * c.green) | 0), blue: Math.min(255,  (f * c.blue) | 0), alpha: a};
		},

		darken: function (c, a) {
			return this.adjust (0.9, c, a);
		},

		lighten: function (c, a) {
			return this.adjust (1.1, c, a);
		},

		random: function () {
			return {red: Math.round(Math.random() * 255) , green: Math.round(Math.random() * 255) , blue: Math.round(Math.random() * 255) , alpha: 1};
		},

		toRGBA: function (c) {
			return "rgba(" + c.red + ", " + c.green + "," + c.blue + "," + c.alpha + ")";
		}
	}
}();