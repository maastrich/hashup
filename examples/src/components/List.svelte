<script>
  export let items = [];
  let newItem = '';

  function addItem() {
    if (newItem.trim()) {
      items = [...items, newItem];
      newItem = '';
    }
  }
</script>

<div class="list-container">
  <input bind:value={newItem} placeholder="Add item..." />
  <button on:click={addItem}>Add</button>

  <ul>
    {#each items as item}
      <li>{item}</li>
    {/each}
  </ul>
</div>

<style>
  .list-container {
    padding: 1rem;
  }
</style>
