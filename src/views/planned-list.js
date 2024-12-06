import { xf, exists, empty, equals, first, last, debounce } from '../functions.js';
import { formatTime } from '../utils.js';
import { models } from '../models/models.js';
import { radioOff, radioOn, removeBtn, options, } from './workout-list.js';


class WorkoutGraphModel {
    constructor() {
        const self = this;
        this.px = this.px ?? 10; // the workouts page font-size from em to absolute px
        this.xOutRange = {min: 0, max: 400};
        this.yOutRange = {min: 0, max: self.calcYOutRangeMax(self.px)};
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
    calcYOutRangeMax(px) {
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

        // width="graphWidth"
        // height="${this.yOutRange.max}"
        return `
            <svg
                class="workout--graph"
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

        this.addEventListener('mouseover', this.onHover.bind(this), this.signal);
        this.addEventListener('mouseout', this.onMouseOut.bind(this), this.signal);
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onHover(e) {
        const self = this;
        const target = this.querySelector('polygon:hover');

        if(exists(target)) {
            const contRect = this.getBoundingClientRect();
            self.renderInfo(target, contRect);
        }
    }
    onMouseOut(e) {
        this.$info.style.display = 'none';
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
        const left         = intervalLeft;
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
// - should extend the workout list graph with watch actions
// - it bridges session, activity and workout
class WorkoutGraphActive extends HTMLElement {
}

customElements.define('workout-graph-active-svg', WorkoutGraphActive);


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
        // this.render();
    }
    onFTP(ftp) {
        this.ftp = ftp;
        this.render();
    }
    onPage(page) {
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
                // return acc + `
                //     <workout-graph-svg>
                //         <div class="graph--info--cont"></div>
                //         ${svg}
                //     </workout-graph-svg>
                // `;

                workout.graph = `
                    <workout-graph-svg>
                        <div class="graph--info--cont"></div>
                        ${svg}
                    </workout-graph-svg>
                `;
                return acc + workoutTemplate(workout);
            }, '');
        }
    }
}

customElements.define('planned-list', PlannedList);


class ActiveListItem extends HTMLElement {
    constructor() {
        super();
        this.isExpanded = false;
        this.isSelected = false;
        this.isOptions = false;
    }
    connectedCallback() {
        console.log(`---- ---- ----`);
        console.log(`ActiveListItem connectedCallback`);
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        // NOTE: assigning to this.id will set the id attribute of the html element,
        // we don't won't that
        const wid = this.dataset.wid;

        xf.sub(`action:li:${wid}`, this.onAction.bind(this), this.signal);

        this.$expandable = this.querySelector('.expandable');
        this.$optional = this.querySelector('.optional');
        this.$selectable = this.querySelector('.selectable');
    }
    disconnectedCallback() {
        console.log(`ActiveListItem disconnectedCallback`);
        console.log(`---- ---- ----`);
        this.abortController.abort();
    }
    onAction(action) {
        if(action === ':select') {
            this.onSelect();
            return;
        }
        if(action === ':toggle') {
            this.onToggle();
            return;
        }
        if(action === ':options') {
            this.onOptions();
            return;
        }
        if(action === ':remove') {
            this.onRemove();
            return;
        }
    }
    onSelect() {
        console.log(`:select`);
        // TODO: add active it should act as a radio btn
        this.$selectable.classList.toggle('active');
        this.isSelected = true;
        // TODO: select
        // xf.dispatch(`ui:workout:select`, this.wid);
    }
    onToggle() {
        this.isExpanded ? this.collapse() : this.expand();
    }
    onOptions() {
        this.isOptions ? this.hideOptions() : this.showOptions();
    }
    onRemove() {
        console.log(`:remove`);
        // TODO: delete
        // xf.dispatch('ui:workout:remove', this.id);
    }
    expand() {
        this.$expandable.classList.toggle('active');
        this.isExpanded = true;
    }
    collapse() {
        this.$expandable.classList.toggle('active');
        this.isExpanded = false;
    }
    showOptions() {
        console.log(`:show :options`);
        this.$optional.classList.toggle('active');
        this.isOptions = true;
    }
    hideOptions() {
        console.log(`:hide :options`);
        this.$optional.classList.toggle('active');
        this.isOptions = false;
    }
}

customElements.define('active-list-item', ActiveListItem);


function workoutTemplate(workout) {
    const id = workout.id;
    const name = workout.meta.name;
    const category = workout.meta.category;
    const graph = workout.graph;
    const description = workout.meta.description;

    let duration = '';
    if(workout.meta.duration) {
        duration = `${Math.round(workout.meta.duration / 60)} min`;
    }
    if(workout.meta.distance) {
        duration = `${(workout.meta.distance / 1000).toFixed(2)} km`;
    }

    return `<active-list-item class='workout active-list-item' data-wid="${id}" metric="ftp">
                <div class="item--cont optional">
                    <div class="summary">
                        <view-action action=":toggle" topic=":li:${id}" class="summary--data">
                            <div class="workout--name">${name}</div>
                            <div class="workout--type">${category}</div>
                            <div class="workout--duration">${duration}</div>

                            <view-action class="selectable" action=":select" topic=":li:${id}" stoppropagation class="item--select" id="btn${id}">
                                <svg class="radio">
                                    <use class="off" href="#icon--radio-off" />
                                    <use class="on" href="#icon--radio-on" />
                                </svg>
                            </view-action>
                            <view-action action=":options" topic=":li:${id}" stoppropagation class="item--options">
                                <svg class="workout--options-btn control--btn--icon"><use href="#icon--options" /></svg>
                            </view-action>
                        </view-action>
                    </div>
                    <div class="details expandable">
                        ${graph}
                        <div class="workout--description">${description}</div>
                    </div>
                </div>
                <div>
                    <view-action action=":remove" topic=":li:${id}" class="optional--actions">
                        <span class="remove">Delete</span>
                    </view-action>
                </div>
            </active-list-item>`;
}


