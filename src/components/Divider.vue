<script setup>
</script>

<template>
    <div class="divider-wrapper">
        <slot name="primary"></slot>
        <div class="divider" data-direction="vertical"></div>
        <slot name="secondary"></slot>
    </div>
</template>

<style scoped>
.divider[data-direction="horizontal"] {
    cursor: ew-resize;
    height: 100%;
    padding: 0px 5px;
    margin: 0px -5px 0px -6px;
    z-index: 3;
    user-select: none;
    transition: 0.3s;
}

.divider[data-direction="horizontal"]:after {
    content: "";
    height: 100%;
    width: 1px;
    background: transparent;
    display: block;
    transition: 0.3s;
}

.divider[data-direction="horizontal"]:hover {
    padding: 0px 10px;
    margin: 0px -10px 0px -12px;
}

.divider[data-direction="horizontal"]:hover:after {
    width: 2px;
}


.divider[data-direction="vertical"] {
    cursor: ns-resize;
    width: 100%;
    padding: 5px 0px;
    margin: -6px 0px -5px 0px;
    z-index: 3;
    user-select: none;
    transition: 0.3s;
}

.divider[data-direction="vertical"]:after {
    content: "";
    width: 100%;
    height: 1px;
    background: transparent;
    display: block;
    transition: 0.3s;
}

.divider[data-direction="vertical"]:hover {
    padding: 10px 0px;
    margin: -12px 0px -10px 0px;
}

.divider[data-direction="vertical"]:hover:after {
    height: 2px;
}

.divider[data-direction="vertical"]:hover:after,
.divider[data-direction="horizontal"]:hover:after {
    background: #7272776b;
}
</style>