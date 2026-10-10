'use strict';
(() => {
  const Core = window.PantryPilotCore;
  const DAYS = [['mon','Пн'],['tue','Вт'],['wed','Ср'],['thu','Чт'],['fri','Пт'],['sat','Сб'],['sun','Вс']];
  const FULL_DAYS = { mon:'Понедельник', tue:'Вторник', wed:'Среда', thu:'Четверг', fri:'Пятница', sat:'Суббота', sun:'Воскресенье' };
  const STORAGE = 'pantrypilot:plan:v1';
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const demo = () => {
    const recipes = [
      { id:'r-soup', name:'Чечевичный суп', servings:4, ingredients:[{name:'Красная чечевица',quantity:300,unit:'g',category:'Бакалея'},{name:'Морковь',quantity:2,unit:'pcs',category:'Овощи'},{name:'Лук',quantity:1,unit:'pcs',category:'Овощи'},{name:'Оливковое масло',quantity:1,unit:'tbsp',category:'Бакалея'}] },
      { id:'r-pasta', name:'Паста с томатами', servings:2, ingredients:[{name:'Паста',quantity:180,unit:'g',category:'Бакалея'},{name:'Томаты',quantity:300,unit:'g',category:'Овощи'},{name:'Чеснок',quantity:2,unit:'clove',category:'Овощи'},{name:'Пармезан',quantity:40,unit:'g',category:'Молочное'}] },
      { id:'r-oats', name:'Овсяная каша', servings:2, ingredients:[{name:'Овсяные хлопья',quantity:100,unit:'g',category:'Бакалея'},{name:'Молоко',quantity:400,unit:'ml',category:'Молочное'},{name:'Банан',quantity:1,unit:'pcs',category:'Фрукты'}] },
      { id:'r-salad', name:'Хрустящий салат', servings:2, ingredients:[{name:'Огурец',quantity:1,unit:'pcs',category:'Овощи'},{name:'Томаты',quantity:200,unit:'g',category:'Овощи'},{name:'Оливковое масло',quantity:2,unit:'tsp',category:'Бакалея'}] },
    ];
    return { recipes, meals:[
      {id:'m1',recipeId:'r-oats',day:'mon',slot:'Завтрак',servings:2},{id:'m2',recipeId:'r-soup',day:'mon',slot:'Обед',servings:4},{id:'m3',recipeId:'r-pasta',day:'tue',slot:'Ужин',servings:3},{id:'m4',recipeId:'r-oats',day:'wed',slot:'Завтрак',servings:2},{id:'m5',recipeId:'r-salad',day:'thu',slot:'Обед',servings:2},{id:'m6',recipeId:'r-soup',day:'fri',slot:'Ужин',servings:2},{id:'m7',recipeId:'r-pasta',day:'sat',slot:'Обед',servings:2}],
      pantry:[{id:'p1',name:'Молоко',quantity:0.5,unit:'l'},{id:'p2',name:'Лук',quantity:2,unit:'pcs'},{id:'p3',name:'Овсяные хлопья',quantity:100,unit:'g'}],checked:[] };
  };
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE));
      if (value && Array.isArray(value.recipes) && Array.isArray(value.meals) && Array.isArray(value.pantry)) return value;
    } catch { /* recover with a fresh usable sample */ }
    return demo();
  }
  let state = load();
  let query = '';
  let editingRecipeId = null;
  const save = () => localStorage.setItem(STORAGE, JSON.stringify(state));
  const recipeFor = (id) => state.recipes.find((recipe) => recipe.id === id);
  const shopping = () => Core.aggregateShoppingList(state.meals.map((meal) => ({ ...meal, recipe:recipeFor(meal.recipeId) })).filter((meal) => meal.recipe), state.pantry);
  const formatQty = (amount) => Number(amount.toFixed(2)).toString().replace('.', ',');
  const formatUnit = (unit, amount) => {
    if (unit === 'pcs') return `${formatQty(amount)} шт.`;
    if (unit === 'g') return amount >= 1000 ? `${formatQty(amount / 1000)} кг` : `${formatQty(amount)} г`;
    if (unit === 'ml') return amount >= 1000 ? `${formatQty(amount / 1000)} л` : `${formatQty(amount)} мл`;
    if (unit === 'clove') return `${formatQty(amount)} зубч.`;
    if (unit === 'can') return `${formatQty(amount)} банк.`;
    return `${formatQty(amount)} ${unit}`.trim();
  };
  const toast = (text) => { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2400); };

  function renderWeek() {
    const list = DAYS.map(([key,label]) => {
      const current = new Date().getDay();
      const isToday = ['sun','mon','tue','wed','thu','fri','sat'][current] === key;
      const meals = state.meals.filter((meal) => meal.day === key).sort((a,b) => ['Завтрак','Обед','Ужин','Перекус'].indexOf(a.slot) - ['Завтрак','Обед','Ужин','Перекус'].indexOf(b.slot));
      const date = new Date(); date.setDate(date.getDate() - ((date.getDay()+6)%7) + DAYS.findIndex((d)=>d[0]===key));
      return `<article class="day-card ${isToday?'today':''}"><div class="day-head"><b>${label}</b><span>${date.getDate()}</span></div>${meals.length ? meals.map((meal) => { const recipe=recipeFor(meal.recipeId); if(!recipe)return ''; return `<div class="meal-card"><button data-remove-meal="${escapeHTML(meal.id)}" aria-label="Удалить блюдо">×</button><strong>${escapeHTML(recipe.name)}</strong><small>${escapeHTML(meal.slot)} · ${formatQty(meal.servings)} порц.</small></div>`; }).join('') : '<div class="meal-empty">Пока свободно</div>'}</article>`;
    }).join('');
    $('week-grid').innerHTML = list;
    const totals = state.meals.reduce((sum, meal) => sum + Number(meal.servings || 0), 0);
    $('meal-count').textContent = state.meals.length;
    $('planned-servings').textContent = formatQty(totals);
    const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7)); const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    $('week-range').textContent = `${monday.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} — ${sunday.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}`;
  }
  function renderRecipes() {
    $('recipe-grid').innerHTML = state.recipes.map((recipe) => `<article class="recipe-card"><div class="recipe-card-top"><span class="eyebrow">БАЗА · ${formatQty(recipe.servings)} ПОРЦ.</span><button class="icon-button" data-edit-recipe="${escapeHTML(recipe.id)}" aria-label="Редактировать рецепт">✎</button></div><h3>${escapeHTML(recipe.name)}</h3><p>${recipe.ingredients.length} ингредиентов</p><div class="recipe-ingredients">${recipe.ingredients.map((x)=>`${escapeHTML(x.name)} · ${formatUnit(x.unit,x.quantity)}`).join('<br>')}</div></article>`).join('') || '<div class="empty"><span>＋</span><h3>Книга пока пуста</h3><p>Добавь рецепт и собери меню недели.</p></div>';
    $('meal-recipe').innerHTML = state.recipes.map((recipe)=>`<option value="${escapeHTML(recipe.id)}">${escapeHTML(recipe.name)}</option>`).join('');
  }
  function renderShopping() {
    let rows;
    try { rows = shopping(); } catch { rows = []; }
    const filtered = rows.filter((item) => item.name.toLocaleLowerCase().includes(query));
    $('item-count').textContent = rows.length;
    $('shopping-badge').textContent = rows.length;
    $('shop-total').textContent = `${rows.length} ${rows.length===1?'позиция':(rows.length>1&&rows.length<5?'позиции':'позиций')}`;
    $('shopping-empty').hidden = filtered.length > 0;
    const groups = new Map();
    for (const row of filtered) { const group = groups.get(row.category) || []; group.push(row); groups.set(row.category, group); }
    $('shopping-list').innerHTML = [...groups].map(([category,items])=>`<section class="shop-category"><h3>${escapeHTML(category)} <span>· ${items.length}</span></h3>${items.map((item)=>{const id=`${item.key}:${item.dimension}`;const checked=state.checked.includes(id);return `<div class="shop-item ${checked?'checked':''}"><input type="checkbox" id="check-${encodeURIComponent(id)}" data-check="${escapeHTML(id)}" ${checked?'checked':''}><label for="check-${encodeURIComponent(id)}">${escapeHTML(item.name)}</label><small>${formatUnit(item.unit,item.quantity)}</small></div>`}).join('')}</section>`).join('');
  }
  function renderPantry() {
    $('pantry-list').innerHTML = state.pantry.map((item,index)=>`<div class="pantry-row"><input class="pantry-name" aria-label="Название запаса ${index+1}" data-pantry="${escapeHTML(item.id)}" data-key="name" value="${escapeHTML(item.name)}"><input type="number" min="0" step="any" aria-label="Количество ${index+1}" data-pantry="${escapeHTML(item.id)}" data-key="quantity" value="${escapeHTML(item.quantity)}"><input aria-label="Единица ${index+1}" data-pantry="${escapeHTML(item.id)}" data-key="unit" value="${escapeHTML(item.unit)}"><button class="icon-button" data-remove-pantry="${escapeHTML(item.id)}" aria-label="Удалить запас">×</button></div>`).join('') || '<div class="empty"><span>＋</span><h3>Запасы не указаны</h3><p>Добавь то, что уже есть дома — список покупок станет точнее.</p></div>';
  }
  function render() { renderWeek(); renderRecipes(); renderShopping(); renderPantry(); save(); }

  document.querySelectorAll('.tab').forEach((tab)=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach((x)=>x.classList.toggle('active',x===tab));document.querySelectorAll('.panel').forEach((x)=>x.classList.toggle('active',x.id===`panel-${tab.dataset.panel}`));}));
  $('add-meal').addEventListener('click',()=>{if(!state.recipes.length){toast('Сначала добавь рецепт в свою книгу.');$('panel-recipes').classList.add('active');document.querySelector('[data-panel="recipes"]').click();return;} $('meal-dialog').showModal();});
  $('meal-form').addEventListener('submit',(event)=>{if(event.submitter?.value==='cancel')return;event.preventDefault();const form=new FormData(event.currentTarget);state.meals.push({id:Core.makeId('meal'),recipeId:form.get('recipeId'),day:form.get('day'),slot:form.get('slot'),servings:Number(form.get('servings'))});$('meal-dialog').close();render();toast('Блюдо добавлено в план.');});
  $('week-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-remove-meal]');if(button){state.meals=state.meals.filter((x)=>x.id!==button.dataset.removeMeal);render();}});
  function addIngredientRow(item={name:'',quantity:'',unit:'g',category:'Другое'}) { const row=document.createElement('div');row.className='ingredient-row';row.innerHTML=`<input aria-label="Название ингредиента" placeholder="Продукт" value="${escapeHTML(item.name)}" required><input aria-label="Количество ингредиента" type="number" min="0" step="any" placeholder="Кол-во" value="${escapeHTML(item.quantity)}" required><input aria-label="Единица ингредиента" placeholder="г / мл / шт." value="${escapeHTML(item.unit)}"><button type="button" class="icon-button" aria-label="Удалить ингредиент">×</button>`;row.querySelector('button').addEventListener('click',()=>row.remove());$('recipe-ingredients').append(row); }
  function openRecipe(recipe=null) { editingRecipeId=recipe?.id||null;$('recipe-dialog-title').textContent=recipe?'Редактировать рецепт':'Новый рецепт';const form=$('recipe-form');form.elements.name.value=recipe?.name||'';form.elements.servings.value=recipe?.servings||2;$('recipe-ingredients').innerHTML='';(recipe?.ingredients||[{name:'',quantity:'',unit:'g',category:'Другое'}]).forEach(addIngredientRow);$('recipe-dialog').showModal(); }
  $('new-recipe').addEventListener('click',()=>openRecipe());
  $('recipe-grid').addEventListener('click',(event)=>{const button=event.target.closest('[data-edit-recipe]');if(button)openRecipe(recipeFor(button.dataset.editRecipe));});
  $('add-ingredient').addEventListener('click',()=>addIngredientRow());
  $('recipe-form').addEventListener('submit',(event)=>{if(event.submitter?.value==='cancel')return;event.preventDefault();try{const rows=[...$('recipe-ingredients').querySelectorAll('.ingredient-row')].map((row)=>({name:row.children[0].value,quantity:row.children[1].value,unit:row.children[2].value,category:'Другое'}));const recipe=Core.createRecipe(event.currentTarget.elements.name.value,event.currentTarget.elements.servings.value,rows);if(editingRecipeId){recipe.id=editingRecipeId;state.recipes=state.recipes.map((x)=>x.id===editingRecipeId?recipe:x);}else state.recipes.push(recipe);$('recipe-dialog').close();render();toast('Рецепт сохранён.');}catch(error){toast(error.message);}});
  $('add-pantry').addEventListener('click',()=>{state.pantry.push({id:Core.makeId('pantry'),name:'',quantity:0,unit:'g'});render();$('pantry-list').querySelector(`[data-pantry="${state.pantry.at(-1).id}"][data-key="name"]`)?.focus();});
  $('pantry-list').addEventListener('input',(event)=>{const input=event.target.closest('[data-pantry]');if(!input)return;const item=state.pantry.find((x)=>x.id===input.dataset.pantry);if(!item)return;item[input.dataset.key]=input.dataset.key==='quantity'?Number(input.value):input.value;renderShopping();renderWeekStatsOnly();save();});
  function renderWeekStatsOnly(){const rows=shopping();$('item-count').textContent=rows.length;$('shopping-badge').textContent=rows.length;$('shop-total').textContent=`${rows.length} позиций`;}
  $('pantry-list').addEventListener('click',(event)=>{const button=event.target.closest('[data-remove-pantry]');if(button){state.pantry=state.pantry.filter((x)=>x.id!==button.dataset.removePantry);render();}});
  $('shopping-list').addEventListener('change',(event)=>{const input=event.target.closest('[data-check]');if(!input)return;const id=input.dataset.check;state.checked=input.checked?[...new Set([...state.checked,id])]:state.checked.filter((x)=>x!==id);renderShopping();save();});
  $('shop-search').addEventListener('input',(event)=>{query=event.target.value.trim().toLocaleLowerCase();renderShopping();});
  function printShopping(){document.querySelector('[data-panel="shopping"]').click();setTimeout(()=>window.print(),100);}
  $('print-list').addEventListener('click',printShopping);$('print-list-2').addEventListener('click',printShopping);
  $('copy-list').addEventListener('click',async()=>{const text=shopping().map((x)=>`[ ] ${x.name} — ${formatUnit(x.unit,x.quantity)} (${x.category})`).join('\n');try{await navigator.clipboard.writeText(text);toast('Список скопирован.');}catch{toast('Не удалось скопировать. Используй печать.');}});
  $('export-plan').addEventListener('click',()=>{const blob=new Blob([Core.exportPlan(state)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='pantrypilot-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
  $('import-plan').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async(event)=>{const file=event.target.files?.[0];if(!file)return;try{state=Core.importPlan(await file.text());render();toast('План импортирован.');}catch(error){toast(error.message);}finally{event.target.value='';}});
  $('reset-demo').addEventListener('click',()=>{state=demo();render();toast('Пример восстановлен.');});
  render();
})();
