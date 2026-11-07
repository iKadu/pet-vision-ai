import { redirect } from 'next/navigation';
import type { Route } from 'next';

export default function VideoAnalysisRedirect() {
  redirect('/dashboard/tests' as Route);
}
