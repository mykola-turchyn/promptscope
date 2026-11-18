export interface Article {
  id: string;
  title: string;
  keywords: string[];
  body: string;
}

const ARTICLES: Article[] = [
  {
    id: 'kb-billing-refund',
    title: 'Повернення коштів',
    keywords: ['поверн', 'refund', 'гроші', 'кошт'],
    body: 'Повернення можливе протягом 14 днів після оплати, якщо використано менше 20% ліміту. Запит надсилається з розділу Billing → Invoices. Кошти повертаються на картку за 5–10 робочих днів.',
  },
  {
    id: 'kb-billing-plans',
    title: 'Тарифи і зміна плану',
    keywords: ['тариф', 'план', 'pro', 'ціна', 'вартість', 'підписк'],
    body: 'Є три плани: Free (1 проєкт), Pro за $29 на місяць (10 проєктів, 1 млн запитів) і Team за $99 (без ліміту проєктів, SSO). Підвищення діє одразу, різниця рахується пропорційно. Зниження діє з наступного періоду.',
  },
  {
    id: 'kb-account-password',
    title: 'Скидання пароля',
    keywords: ['пароль', 'увійти', 'вхід', 'логін', 'password'],
    body: 'Натисніть «Забули пароль?» на сторінці входу. Лист із посиланням приходить протягом хвилини й діє 30 хвилин. Якщо лист не прийшов, перевірте спам або напишіть у підтримку з адреси акаунта.',
  },
  {
    id: 'kb-account-2fa',
    title: 'Двофакторна автентифікація',
    keywords: ['2fa', 'двофактор', 'код', 'автентифікац'],
    body: 'Увімкніть 2FA в Settings → Security через застосунок-автентифікатор. Збережіть 10 резервних кодів. Якщо телефон втрачено, увійдіть резервним кодом або зверніться в підтримку з документом, що посвідчує особу.',
  },
  {
    id: 'kb-api-limits',
    title: 'Ліміти API',
    keywords: ['ліміт', '429', 'rate', 'запит', 'api'],
    body: 'Free: 10 запитів на секунду, Pro: 100, Team: 500. При перевищенні API повертає 429 із заголовком Retry-After. Ліміт рахується на ключ, тому кілька ключів одного проєкту мають окремі ліміти.',
  },
  {
    id: 'kb-api-keys',
    title: 'API-ключі',
    keywords: ['ключ', 'key', 'токен'],
    body: 'Ключ створюється в Settings → API keys і показується один раз. Відкликаний ключ перестає працювати протягом хвилини. Для продакшну й тестів краще мати окремі ключі.',
  },
  {
    id: 'kb-data-export',
    title: 'Експорт даних',
    keywords: ['експорт', 'export', 'csv', 'вивантаж', 'дані'],
    body: 'Дані експортуються в CSV або JSON у Settings → Data. Експорт до 100 тисяч рядків готується одразу, більший надсилається посиланням на пошту протягом години.',
  },
];

export function searchArticles(question: string, limit = 2): Article[] {
  const text = question.toLowerCase();
  const scored = ARTICLES.map((article) => ({
    article,
    hits: article.keywords.filter((keyword) => text.includes(keyword)).length,
  }));

  return scored
    .filter(({ hits }) => hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, limit)
    .map(({ article }) => article);
}
