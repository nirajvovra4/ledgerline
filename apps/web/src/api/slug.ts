import { useParams } from 'react-router-dom';

/** The workspace slug from the current `/w/:slug/...` route. */
export function useSlug(): string {
  const { slug } = useParams<{ slug: string }>();
  return slug ?? '';
}
