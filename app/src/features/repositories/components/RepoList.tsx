import { useRepositories } from '../api/useRepositories';

export const RepoList = () => {
  const { data, isLoading } = useRepositories();
  if (isLoading) return <div>Loading...</div>;
  return <div>{data?.map(r => <div key={r.id} className="p-2 border-b">{r.url} ({r.branch})</div>)}</div>;
};
