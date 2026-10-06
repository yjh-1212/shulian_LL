const hourFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: 'numeric',
  hourCycle: 'h23',
});

export function workbenchGreeting(now: number): string {
  // Chinese hour text includes “时”; read only the numeric hour part.
  const hour = Number(hourFormatter.formatToParts(now).find(part => part.type === 'hour')?.value);
  return hour < 6 ? '你好' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
}
