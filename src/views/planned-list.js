import { xf, exists, empty, equals, first, last, debounce } from '../functions.js';
import { formatTime } from '../utils.js';
import { models } from '../models/models.js';
import { radioOff, radioOn, removeBtn, options, } from './workout-list.js';


class WorkoutGraphModel {
    constructor() {
        const self = this;
        this.xOutRange = {min: 0, max: 400};
        this.yOutRange = {min: 0, max: self.calcYOutRangeMax()};
        this.xInRange = {min: 0, max: 1};
        this.yInRange = {min: 0, max: 1};
    }
    translate(value, inRange, outRange) {
        const inSpan = inRange.max - inRange.min;
        const outSpan = outRange.max - outRange.min;

        const valueScaled = (value - inRange.min) / (inSpan);

        return inRange.min + (valueScaled * outSpan);
    }
    findMaxTarget(workout) {
        const intervals = workout.intervals;
        let interval;
        let step;
        let max = 0;
        for(let i = 0; i < intervals.length; i++) {
            interval = intervals[i];
            for(let j = 0; j < interval.steps.length; j++) {
                step = interval.steps[j];
                if(step.power > max) max = step.power;
            }
        }
        return max;
    }
    calcYOutRangeMax() {
        const parent = document.querySelector('#workouts-page');
        const px = parseFloat(window.getComputedStyle(parent).fontSize);
        const em = 8;
        return px * em;
    }
    calcYInRangeMax(data, ftp) {
        const self = this;
        const targetMax = Math.round(self.findMaxTarget(data) * ftp);
        return (targetMax > ftp) ? targetMax : ftp * 1.6;
    }
    intervalToInfo(interval) {
        const firstStep = first(interval.steps);
        const lastStep = last(interval.steps);

        const powerStart = models.ftp.toAbsolute(firstStep.power);
        const powerEnd = models.ftp.toAbsolute(lastStep.power);
        const cadenceStart = firstStep.cadence;
        const cadenceEnd = lastStep.cadence;
        const slopeStart = firstStep.slope;
        const slopeEnd = lastStep.slope;

        const duration = `${formatTime({value: interval.duration ?? 0, format: 'mm:ss'})}min`;
        const power = exists(powerStart) ? powerStart === powerEnd ?
              `${powerStart}W` : `${powerStart}-${powerEnd}W` : '';

        const cadence = exists(cadenceStart) ? cadenceStart === cadenceEnd ?
              `${cadenceStart}W` : `${cadenceStart}-${cadenceEnd}rpm` : '';

        const slope = exists(slopeStart) ? slopeStart === slopeEnd ?
              `${slopeStart}%` : `${slopeStart}-${slopeEnd}%` : '';

        return { duration, power, cadence, slope, };
    }
    // Int
    // ->
    // String
    toSVG(data, ftp = 200, size) {
        const self = this;


        const intervals = data.intervals;
        let graphWidth = window.innerWidth;
        if(size) {
            self.yOutRange.max = size.height;
            graphWidth = size.width;
        }
        this.xOutRange.max = graphWidth;
        this.xInRange.max = data?.meta?.duration;

        self.yInRange.max = self.calcYInRangeMax(data, ftp);

        // initial values
        let   x  = self.xOutRange.min;
        let   x0 = self.xOutRange.min;
        const y0 = self.yOutRange.min;
        let   x1 = self.xOutRange.min;
        let   y1 = self.yOutRange.min;
        let   x2 = self.xOutRange.min;
        let   y2 = self.yOutRange.min;
        let   x3 = self.xOutRange.min;
        const y3 = self.yOutRange.min;

        let heightStart = self.yOutRange.min;
        let heightEnd   = self.yOutRange.min;
        let powerStart  = 0;
        let powerEnd    = 0;
        let width       = 0;

        const initialInterval = {duration: 0, steps: [{duration: 0, power: 0}]};
        const initialStep = initialInterval.steps[0];
        let stepPrev = initialStep;
        let points = '';
        let color  = '#328AFF';

        // accumulators
        let accX = 0;
        let acc = '';

        for(let i = 0; i < intervals.length; i++) {
            let intervalPrev = (i === 0) ? initialInterval : intervals[i-1];
            let interval     = intervals[i];

            // TODO: handle ramps zone change
            // for(let j = 0; j < interval.steps.length; j++) {
            // }

            powerStart = models.ftp.toAbsolute(first(interval.steps)?.power, ftp);
            powerEnd = models.ftp.toAbsolute(last(interval.steps)?.power, ftp);

            accX += intervalPrev.duration;

            x = self.translate(accX, self.xInRange, self.xOutRange);
            width = self.translate(interval.duration, self.xInRange, self.xOutRange);
            heightStart = self.translate(powerStart, self.yInRange, self.yOutRange);
            heightEnd = self.translate(powerEnd, self.yInRange, self.yOutRange);

            x0 = x;
            x1 = x;
            y1 = heightStart;
            x2 = x1+width;
            y2 = heightEnd;
            x3 = x+width;

            points = `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
            color = models.ftp.zoneToColor(
                models.ftp.powerToZone(powerStart, ftp).name
            );

            const info = self.intervalToInfo(interval);

            acc += `<polygon points="${points}"
                             fill="${color}"
                             power="${info.power}"
                             cadence="${info.cadence}"
                             slope="${info.slope}"
                             duration="${info.duration}" />`;
        }

        return `
            <svg
                class="workout--graph"
                width="${graphWidth}"
                height="${this.yOutRange.max}"
                viewBox="0 0 ${graphWidth} ${this.yOutRange.max}"
                preserveAspectRatio="">
                <g transform="matrix(1 0 0 -1 0 ${this.yOutRange.max})">
                    ${acc}
                </g>
            </svg>
            `;
    }
}

class WorkoutGraph extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.$info = this.querySelector('.graph--info--cont');
        this.rect = this.getBoundingClientRect();

        this.addEventListener('mouseover', this.onHover.bind(this), this.signal);
        this.addEventListener('mouseout', this.onMouseOut.bind(this), this.signal);
        window.addEventListener('resize', this.onWindowResize.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onHover(e) {
        const self = this;
        const target = this.querySelector('polygon:hover');

        if(exists(target)) {
            self.renderInfo(target, self.rect);
        }
    }
    onMouseOut(e) {
        this.$info.style.display = 'none';
    }
    onWindowResize() {
        const rect = this.getBoundingClientRect();
        console.log(`onWindowResize ${rect.width}`);
        if(rect.width > 0) {
            this.rect = rect;
        }
    }
    // TODO: simplify
    renderInfo(target, contRect) {
        const power    = target.getAttribute('power');
        const cadence  = target.getAttribute('cadence');
        const slope    = target.getAttribute('slope');
        const duration = target.getAttribute('duration');

        const rect = target.getBoundingClientRect();

        const intervalLeft = rect.left;
        const contLeft     = contRect.left;
        const contWidth    = contRect.width;
        const left         = intervalLeft - contLeft;
        const bottom       = rect.height;

        this.$info.style.display = 'block';
        this.$info.innerHTML = `<div>${power}</div><div>${cadence}</div><div>${slope}</div><div class="graph--info--time">${duration}</div>`;

        const width  = this.$info.getBoundingClientRect().width;
        const height = this.$info.getBoundingClientRect().height;
        const minHeight = (bottom + height + (40)); // fix 40
        this.$info.style.left = `min(${contWidth}px - ${width}px, ${left}px)`;

        if(window.innerHeight > minHeight) {
            this.$info.style.bottom = bottom;
        } else {
            this.$info.style.bottom = bottom - (minHeight - window.innerHeight);
        }
    }
}

customElements.define('workout-graph-svg', WorkoutGraph);


// TODO:
// - Use Model as a way to store, and isolated the operations on the data,
//   and potentially share it
// - use directly the Model to that view, not just the data through sub
// - maybe no need to have list data in db, just the shared session data
class PlannedList extends HTMLElement {
    constructor() {
        super();
        this.capacity = 10;
        this.index = 0;
        this.model = models.planned;
        this.graph = new WorkoutGraphModel();
    }
    connectedCallback() {
        console.log(`PlannedList connectedCallback`);
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        // xf.sub('db:workout',  this.onWorkout.bind(this), this.signal); // ?
        xf.sub(`db:ftp`,      this.onFTP.bind(this), this.signal);
        xf.sub('action:planned', self.onAction.bind(this), this.signal);

        // TODO: maybe debounce the resize
        window.addEventListener('resize', this.onWindowResize.bind(this), this.signal);

        self.size = self.getSize();
        this.render();
    }
    disconnectedCallback() {
        console.log(`PlannedList diconnectedCallback`);
        this.abortController.abort();
    }
    onAction(action) {
        // TODO: handle this directly in db
        if(action === ':data') {
            this.render();
            return;
        }
        if(action === ':intervals:wod') {
            models.planned.wod('intervals');
            return;
        }
        if(action === ':trainingPeaks:wod') {
            models.planned.wod('trainingPeaks');
            return;
        }
    }
    getSize() {
        const self = this;
        const parent = document.querySelector('#workouts-page');
        const em = 8;
        const px = parseFloat(window.getComputedStyle(parent).fontSize);
        // .getPropertyValue('font-size')
        const height = px * em;
        const width = self.getBoundingClientRect().width ?? window.innerWidth;
        return { width, height };
    }
    onWindowResize() {
        this.render();
    }
    onFTP(ftp) {
        this.ftp = ftp;
        this.render();
    }
    render() {
        const self = this;

        console.log(`Planned List render ${models.planned.data.length}, visible: ${this.checkVisibility()}`);

        if(this.checkVisibility()) {
            self.size = self.getSize();
        };

        if(empty(models.planned.data)) {
            self.innerHTML =  `
                <div class="planned--empty">
                    <p>You have no planned workouts for today.</p>
                </div>`;
        } else {
            self.innerHTML = models.planned.data.reduce((acc, workout) => {
                const svg = self.graph.toSVG(workout, self.ftp, self.size);
                return acc + `
                    <workout-graph-svg>
                        <div class="graph--info--cont"></div>
                        ${svg}
                    </workout-graph-svg>
                `;

                // workout.graph = `
                //     <workout-graph-svg>
                //         <div class="graph--info--cont"></div>
                //         ${svg}
                //     </workout-graph-svg>
                // `;
                // return acc + workoutTemplate(workout);
            }, '');
        }
    }
}

function workoutTemplate(workout) {
    let duration = '';
    if(workout.meta.duration) {
        duration = `${Math.round(workout.meta.duration / 60)} min`;
    }
    return `<planned-item class='workout cf' id="${workout.id}" metric="ftp">
                <div class="workout--info">
                    <div class="workout--short-info">
                        <div class="workout--summary">
                            <div class="workout--name">${workout.meta.name}</div>
                            <div class="workout--type">${workout.meta.category}</div>
                            <div class="workout--duration">${duration}</div>
                            <div class="workout--select" id="btn${workout.id}">${workout.selected ? radioOn : radioOff}
                            </div>
                            <div class="workout--options">${options}</div>
                        </div>
                    </div>
                    <div class="workout--full-info">
                        <div class="workout-list--graph-cont">${workout.graph}</div>
                        <div class="workout--description">${workout.meta.description}</div>
                    </div>
                </div>
                <div class="workout--actions">
                    <span class="workout--remove">Delete</span>
                </div>
            </planned-item>`;
}

customElements.define('planned-list', PlannedList);

