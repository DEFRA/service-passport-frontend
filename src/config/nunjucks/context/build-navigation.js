export function buildNavigation(request) {
  return [
    {
      text: 'Programme',
      href: '/',
      current: request?.path === '/'
    }
  ]
}
