<script lang="ts">
  import { onMount } from 'svelte';
  import { readAeonChecked, writeAeon } from '@altopelago/aeon-sdk';

  type Todo = {
    id: string;
    title: string;
    done: boolean;
  };

  const APP_ID = 'todo';
  const STORAGE_KEY = 'aeon-web-todo:draft';
  const VERSION = 1;

  let todos: Todo[] = [];
  let newTitle = '';
  let status = 'Loading draft...';
  let sourceName = 'Browser draft';
  let busy = false;
  let fileInput: HTMLInputElement | undefined;

  function asTodoList(input: unknown): Todo[] {
    if (!Array.isArray(input)) return [];
    return input
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const raw = entry as Record<string, unknown>;
        if (typeof raw.title !== 'string' || raw.title.trim().length === 0) return null;
        return {
          id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
          title: raw.title,
          done: Boolean(raw.done),
        } as Todo;
      })
      .filter((entry): entry is Todo => entry !== null);
  }

  function parseAeon(source: string): Todo[] {
    if (!source.trim()) return [];
    const result = readAeonChecked(source, { finalize: { mode: 'loose' } });
    const doc = result.finalized.document as Record<string, unknown>;
    if (doc.app !== APP_ID) {
      throw new Error(`Unexpected AEON app type: ${String(doc.app)}`);
    }
    return asTodoList(doc.todos);
  }

  function emitAeon(): string {
    const emitted = writeAeon(
      {
        app: APP_ID,
        version: VERSION,
        todos: todos.map((todo) => ({
          id: todo.id,
          title: todo.title,
          done: todo.done,
        })),
      },
      {
        includeHeader: true,
        header: {
          encoding: 'utf-8',
          mode: 'transport',
          profile: 'aeon.gp.profile.v1',
          version: 1,
        },
      },
    );
    if (emitted.errors.length > 0) {
      throw new Error(`AEON emit errors: ${emitted.errors.length}`);
    }
    return emitted.text;
  }

  function addTodo() {
    const title = newTitle.trim();
    if (!title) return;
    todos = [{ id: crypto.randomUUID(), title, done: false }, ...todos];
    newTitle = '';
    saveDraft();
  }

  function toggleTodo(id: string) {
    todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
    saveDraft();
  }

  function removeTodo(id: string) {
    todos = todos.filter((todo) => todo.id !== id);
    saveDraft();
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, emitAeon());
      status = `Saved browser draft with ${todos.length} todo(s).`;
    } catch (error) {
      status = `Draft save failed: ${String(error)}`;
    }
  }

  function newList() {
    todos = [];
    sourceName = 'Browser draft';
    saveDraft();
  }

  function downloadTodos() {
    busy = true;
    try {
      const text = emitAeon();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sourceName.endsWith('.aeon') ? sourceName : 'todos.aeon';
      link.click();
      URL.revokeObjectURL(url);
      localStorage.setItem(STORAGE_KEY, text);
      status = `Downloaded ${todos.length} todo(s).`;
    } catch (error) {
      status = `Download failed: ${String(error)}`;
    } finally {
      busy = false;
    }
  }

  function requestImport() {
    fileInput?.click();
  }

  async function importTodos(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    try {
      const content = await file.text();
      todos = parseAeon(content);
      sourceName = file.name;
      localStorage.setItem(STORAGE_KEY, emitAeon());
      status = content.trim()
        ? `Loaded ${todos.length} todo(s)`
        : 'Opened empty AEON file.';
    } catch (error) {
      status = `Load failed: ${String(error)}`;
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (!draft) {
      status = 'Start a new list or import an .aeon file.';
      return;
    }
    try {
      todos = parseAeon(draft);
      status = `Restored browser draft with ${todos.length} todo(s).`;
    } catch (error) {
      status = `Stored draft could not be loaded: ${String(error)}`;
    }
  });
</script>

<main>
  <section class="panel">
    <h1>AEON Todo</h1>
    <p class="status">{status}</p>
    <p class="source">{sourceName}</p>

    <div class="toolbar">
      <button type="button" onclick={requestImport} disabled={busy}>Import .aeon</button>
      <button type="button" class="primary" onclick={downloadTodos} disabled={busy}>
        {busy ? 'Working...' : 'Download .aeon'}
      </button>
      <button type="button" onclick={newList} disabled={busy}>New list</button>
    </div>
    <input
      bind:this={fileInput}
      class="file-input"
      type="file"
      accept=".aeon,text/plain"
      onchange={importTodos}
    />

    <div class="create-row">
      <input
        bind:value={newTitle}
        type="text"
        placeholder="Add a todo..."
        onkeydown={(event) => event.key === 'Enter' && addTodo()}
      />
      <button type="button" onclick={addTodo}>Add</button>
    </div>

    <ul class="todos">
      {#each todos as todo (todo.id)}
        <li>
          <label>
            <input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo.id)} />
            <span class:done={todo.done}>{todo.title}</span>
          </label>
          <button type="button" class="danger" onclick={() => removeTodo(todo.id)}>Delete</button>
        </li>
      {/each}
      {#if todos.length === 0}
        <li class="empty">No todos yet.</li>
      {/if}
    </ul>
  </section>
</main>
