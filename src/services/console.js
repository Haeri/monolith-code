import { reactive } from "vue";

const consoleQueue = ref([]);

function addToQueue(message, type) {
    consoleQueue.push({message, type});
}