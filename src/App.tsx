import { isISODate, mealForTime, todayISO } from './lib/dates';
import { mealsOf, useSettingsState } from './lib/hooks';
import { useLang } from './lib/i18n';
import { parseNum } from './lib/nutrition';
import { useRoute } from './lib/router';
import type { MealId } from './lib/types';
import { AddView } from './views/AddView';
import { DiaryView } from './views/DiaryView';
import { FoodEditView } from './views/FoodEditView';
import { ImportView } from './views/ImportView';
import { LogView } from './views/LogView';
import { MyFoodsView } from './views/MyFoodsView';
import { QuickAddView } from './views/QuickAddView';
import { RecipeEditView } from './views/RecipeEditView';
import { ScanView } from './views/ScanView';
import { SettingsView } from './views/SettingsView';

function View() {
  const { path, parts, query } = useRoute();
  const settings = useSettingsState();
  if (!settings) return null; // meals live in settings; wait so a custom meal in the URL resolves
  const meals = mealsOf(settings);
  const [section, a, b, c] = parts;
  const date = isISODate(a) ? a : todayISO();
  const meal: MealId = b && meals.some((m) => m.id === b) ? b : mealForTime(new Date(), meals);

  switch (section) {
    case 'day':
      return <DiaryView key={date} date={date} />;
    case 'add':
      return <AddView key={date} date={date} meal={meal} initialQuery={query.get('q') ?? ''} />;
    case 'scan':
      return <ScanView date={date} meal={meal} />;
    case 'quick':
      return <QuickAddView date={date} meal={meal} />;
    case 'log':
      return (
        <LogView
          key={path}
          date={date}
          meal={meal}
          foodId={c}
          preset={{ n: parseNum(query.get('n')), u: query.get('u') ?? undefined }}
        />
      );
    case 'entry':
      return <LogView key={a} entryId={Number(a)} />;
    case 'recipe':
      return <RecipeEditView key={path} query={query} />;
    case 'food':
      if (a === 'new') return <FoodEditView key={path} query={query} />;
      if (a?.startsWith('recipe:')) return <RecipeEditView key={a} id={a} query={query} />;
      return <FoodEditView key={a} id={a} query={query} />;
    case 'import':
      return <ImportView data={query.get('f') ?? ''} />;
    case 'foods':
      return <MyFoodsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <DiaryView date={todayISO()} />;
  }
}

export default function App() {
  const lang = useLang();
  return (
    <div className="app" key={lang}>
      <View />
    </div>
  );
}
