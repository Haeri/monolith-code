<script setup>
import { ref } from "@vue/reactivity";

const emit = defineEmits(["selected"]);

const props = defineProps({
    options: Object,
    default: String
});

const selected = ref(
    {
        key: props.default,
        props: props.options[props.default]
    });
const isOpen = ref(false);

const optionRefs = ref([]);

function choose() {
    isOpen.value = false;
    emit("selected", selected.value.key);
}

function select(key, close = true) {
    selected.value = {
        key: key,
        props: props.options[key]
    };

    if (close) {
        choose();
    } else {
        let index = Object.keys(props.options).findIndex(el => el === key);
        let element = optionRefs.value[index];
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }
}

function cycleSelect(e) {
    if (e.key.length === 1) {
        let selectedKey = e.key.toLowerCase();
        let validOptions = Object.entries(props.options).map(([key, val], i) => ({ i, key, val })).filter(el => el.val.name.toLowerCase().startsWith(selectedKey));

        if (validOptions.length === 1) {
            let key = validOptions[0].key;
            select(key, false);
        } else if (validOptions.length > 1) {
            let key = validOptions[0].key;

            if (selected.value.props.name.toLowerCase().startsWith(selectedKey)) {
                let currIndex = validOptions.findIndex(el => el.key === selected.value.key);
                let next = (currIndex + 1) % validOptions.length;
                key = validOptions[next].key;
            }

            select(key, false);
        }
    }
}
</script>

<template>
    <div class="select-box" @keypress.enter="choose" @keyup="cycleSelect" @blur="isOpen = false" tabindex="0">
        <div @click="isOpen = !isOpen" class="selected">{{ selected.props.name }}</div>
        <div class="panel options-container" :class="{ active: isOpen }">
            <div @click="select(key)" class="option" :class="{ active: key === selected.key }"
                v-for="(option, key) in options" :key="key" ref="optionRefs">
                {{ option.name }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.select-box {
    position: relative;
    outline: none;
}

.select-box .options-container {
    padding: 0;

    max-height: 0;
    opacity: 0;
    transition: 0.3s;
    overflow: hidden;
    overflow-y: scroll;

    position: absolute;
    bottom: 30px;
    right: 0;
    z-index: 10;
}

.select-box .options-container.active {
    max-height: 70vh;
    opacity: 1;
}

.select-box .option,
.selected {
    padding: 8px 24px;
    cursor: pointer;
    transition: 0.3s;
}

.select-box .option.active {
    border-left: 2px solid #2443f0;
    background: #ffffff03;
}

.selected {
    padding: 0;
    border-radius: 8px;
    text-transform: lowercase;
}

.selected:hover {
    background: rgba(255, 255, 255, 0.01);
}

.select-box .option:hover {
    color: white;
    background-color: #2443f0;
    box-shadow: 0px 0px 26px 1px #2844e058;
}
</style>