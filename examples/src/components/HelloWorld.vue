<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <p>Count: {{ count }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  msg: string;
}

defineProps<Props>();

const count = ref(0);

function increment() {
  count.value++;
}
</script>

<style scoped>
.hello {
  padding: 20px;
}
</style>
