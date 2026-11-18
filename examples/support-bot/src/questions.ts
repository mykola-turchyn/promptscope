export interface CustomerQuestion {
  userId: string;
  topic: string;
  text: string;
}

export const QUESTIONS: CustomerQuestion[] = [
  { userId: 'u_1042', topic: 'billing', text: 'Як повернути гроші за підписку? Оплатив учора.' },
  { userId: 'u_1042', topic: 'billing', text: 'Скільки коштує план Pro і що в нього входить?' },
  { userId: 'u_2210', topic: 'account', text: 'Не можу увійти, забув пароль. Що робити?' },
  { userId: 'u_2210', topic: 'account', text: 'Загубив телефон з 2FA, як тепер зайти?' },
  { userId: 'u_3377', topic: 'api', text: 'Отримую 429 від API. Який у мене ліміт запитів?' },
  { userId: 'u_3377', topic: 'api', text: 'Чи можна мати кілька API-ключів для одного проєкту?' },
  { userId: 'u_4805', topic: 'data', text: 'Як зробити експорт усіх даних у CSV?' },
  { userId: 'u_4805', topic: 'billing', text: 'Якщо перейти з Team на Pro, коли зміниться ціна?' },
  { userId: 'u_5931', topic: 'other', text: 'Чи є у вас мобільний застосунок для iOS?' },
  { userId: 'u_5931', topic: 'other', text: 'Де знаходиться ваш офіс і чи можна прийти особисто?' },
];
