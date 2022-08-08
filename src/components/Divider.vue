<script setup>
import { ref } from "@vue/reactivity";
import { onMounted } from "@vue/runtime-core";

const props = defineProps({
    direction: {
        type: String,
        required: true
    },
    dbclickPercentage: Number
})

const emit = defineEmits(["resized"]);

const divisionPercentage = ref(props.dbclickPercentage);
const isResizing = ref(false);

const resizer = ref(null);

const resizable = (resizer) => {
    const prevSibling = resizer.value.previousElementSibling;
    const nextSibling = resizer.value.nextElementSibling;

    // The current position of mouse
    let x = 0;
    let y = 0;
    let prevSiblingHeight = 0;
    let prevSiblingWidth = 0;

    const mouseMoveHandler = (e) => {
        // How far the mouse has been moved
        const dx = e.clientX - x;
        const dy = e.clientY - y;

        switch (props.direction) {
            case 'vertical': {
                const h = (prevSiblingHeight + dy) * 100 / resizer.value.parentNode.getBoundingClientRect().height;
                divisionPercentage.value = h;
                break;
            }
            case 'horizontal':
            default: {
                const w = (prevSiblingWidth + dx) * 100 / resizer.value.parentNode.getBoundingClientRect().width;
                // prevSibling.style.width = `${w}% `;
                divisionPercentage.value = w;
                break;
            }
        }


        isResizing.value = true;
    };

    const mouseUpHandler = () => {
        // resizer.value.style.removeProperty('cursor');
        // document.body.style.removeProperty('cursor');

        isResizing.value = false;

        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        // Dispatch the event
        // const event = new CustomEvent('divider-move');
        // resizer.value.dispatchEvent(event);
        emit('resized', divisionPercentage.value);
    };

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = (e) => {
        // Get the current mouse position
        x = e.clientX;
        y = e.clientY;
        const rect = prevSibling.getBoundingClientRect();
        prevSiblingHeight = rect.height;
        prevSiblingWidth = rect.width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    resizer.value.addEventListener('mousedown', mouseDownHandler);
};

onMounted(() => {
    resizable(resizer);

    resizer.value.addEventListener('dblclick', () => {
        const targetPercent = Math.abs(divisionPercentage.value - 50) < 1 ? 100 : 50;

        const anim = resizer.value.previousElementSibling.animate([
            { height: divisionPercentage.value + "%" },
            { height: targetPercent + "%" },
        ], {
            duration: 450,
            easing: 'cubic-bezier(0.860, 0.000, 0.070, 1.000)',
        });
        anim.finished.then(() => {
            divisionPercentage.value = targetPercent;
            emit('resized', divisionPercentage.value);
        });
    });
});



</script>

<template>
    <div class="divider-wrapper" :class="direction">
        <div :class="{ disabled: isResizing }" :style="{ height: divisionPercentage + '%' }">
            <slot name="primary"></slot>
        </div>
        <div ref="resizer" class="divider"></div>
        <!--div class="second" :class="{ disabled: isResizing }"-->
            <slot name="secondary" :class="{ disabled: isResizing }"></slot>
        <!--/div-->
    </div>
</template>

<style scoped>
.divider-wrapper {
    display: flex;
    height: 100%;
    /*
    box-shadow: 0px 2px 20px #0000006e;
    z-index: 1;
    */
    overflow: hidden;
}

.second{
flex: 1;
}

.vertical {
    flex-direction: column;
}

.horizontal {
    flex-direction: row;    
}


.disabled {
    userSelect: none !important;
    pointerEvents: none !important;
}

.divider-wrapper.horizontal .divider {
    cursor: ew-resize;
    height: 100%;
    padding: 0px 5px;
    margin: 0px -5px 0px -6px;
    z-index: 3;
    user-select: none;
    transition: 0.3s;
}

.divider-wrapper.horizontal .divider:after {
    content: "";
    height: 100%;
    width: 1px;
    background: transparent;
    display: block;
    transition: 0.3s;
}

.divider-wrapper.horizontal .divider:hover {
    padding: 0px 10px;
    margin: 0px -10px 0px -12px;
}

.divider-wrapper.horizontal .divider:hover:after {
    width: 2px;
}


.divider-wrapper.vertical .divider {
    cursor: ns-resize;
    width: 100%;
    padding: 5px 0px;
    margin: -6px 0px -5px 0px;
    z-index: 3;
    user-select: none;
    transition: 0.3s;
}

.divider-wrapper.vertical .divider:after {
    content: "";
    width: 100%;
    height: 1px;
    background: transparent;
    display: block;
    transition: 0.3s;
}

.divider-wrapper.vertical .divider:hover {
    padding: 10px 0px;
    margin: -12px 0px -10px 0px;
}

.divider-wrapper.vertical .divider:hover:after {
    height: 2px;
}

.divider-wrapper.vertical .divider:hover:after,
.divider-wrapper.horizontal .divider:hover:after {
    background: #7272776b;
}
</style>