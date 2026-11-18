import { useFetcher, useLocation } from 'react-router';
import { Button } from '~/components/ui/Button';
import { Icon } from '~/components/ui/Icon';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function nextTheme(): 'light' | 'dark' {
  const { classList } = document.documentElement;
  const isDark =
    classList.contains('dark') || (!classList.contains('light') && matchMedia(DARK_QUERY).matches);

  return isDark ? 'light' : 'dark';
}

export function ThemeToggle() {
  const fetcher = useFetcher();
  const location = useLocation();

  return (
    <fetcher.Form
      method="post"
      action="/theme"
      onSubmit={(event) => {
        event.preventDefault();
        const theme = nextTheme();
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        fetcher.submit({ theme }, { method: 'post', action: '/theme' });
      }}
    >
      <input type="hidden" name="redirectTo" value={`${location.pathname}${location.search}`} />
      <Button
        type="submit"
        size="icon"
        className="text-fg"
        aria-label="Switch between light and dark theme"
        title="Switch between light and dark theme"
      >
        <Icon name="sun" className="hidden dark:block" />
        <Icon name="moon" className="dark:hidden" />
      </Button>
    </fetcher.Form>
  );
}
