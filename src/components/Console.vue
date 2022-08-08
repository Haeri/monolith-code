<script setup>
import { ref } from "@vue/reactivity";

const props = defineProps({
	statusBarRef: Object
})

const logs = ref([]);

const consoleRef = ref(null);

function getModeName(mode){
	return Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode);
}

function print(text, mode = INFO_LEVEL.info) {
	const block = document.createElement('div');
	//block.classList.add(Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode));

	//errorSVG.get().then((svg) => {
	//    block.innerHTML = (mode === 4 ? svg : '') + text;
	//  });
	//consoleOutUi.appendChild(block);

	logs.value.push({ mode, text });

	if (mode >= 2) {
		const ret = Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode);
		props.statusBarRef.notify(ret);
	}

	setTimeout(() => consoleRef.value.scrollTo({ top: consoleRef.value.scrollHeight, behavior: 'smooth' }), 0);
}


defineExpose({
	print
});

</script>

<template>
	<div ref="consoleRef" id="console">
		<pre id="console-out" >
			<div v-for="(log, i) in logs" :key="i" :class="getModeName(log.mode)" v-html="log.text"></div>
		</pre>
		<textarea id="console-in" spellcheck="false"></textarea>
		<span id="process-indicator"></span>
	</div>
</template>

<style scoped>
#console {
	flex: 1;
	min-height: 0;
	height: 0;
	overflow-y: auto;
	background: #191919;
	display: flex;
	flex-direction: column;
	position: relative;

	box-shadow: inset 0 16px 17px -10px black;
}

#console #console-in,
#console #console-out {
	white-space: pre-wrap;
	box-sizing: border-box;
	display: block;
	width: 100%;
	border: none;
	outline: none;
	margin: 0;
	background: transparent;
	font-size: var(--font-size);
	font-family: 'Source Code Pro', monospace;
}

#console #console-out {
	background: #1b1b1b;
	color: #a9a9a9;
	padding: 10px 0px;
}

#console #console-in {
	color: #ffffff;
	flex: 1;
	resize: none;
	display: inline-table;
	padding: 4px 8px;
}

#console #process-indicator {
	position: fixed;
	display: block;
	right: 24px;
	bottom: 54px;
	width: 6px;
	height: 6px;
	border-radius: 100%;
	background: #f44336;
	opacity: 0;
	transition: 0.3s;
	box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.1);
	transform: scale(1);
	animation: pulse 2s infinite;
}

#console #process-indicator.active {
	opacity: 1;
}

#console #console-out>div {
	padding: 0px 8px;
}

#console #console-out .user {
	color: #f1f1f1;
	margin: 10px 0px;
	padding: 4px 8px;
	background: #1d1d1d;
}

#console #console-out .info {
	color: #838383;
}

#console #console-out .confirm {
	color: #4caf50;
}

#console #console-out .warn {
	color: #ffeb3b;
}

#console #console-out .error {
	color: #f44336;
}

#console #console-out .error svg {
	width: 10px;
	height: 10px;
	fill: #f44336;
	margin-right: 5px;
	vertical-align: -1px;
}

.jump-to-line {
	color: inherit;
}
</style>