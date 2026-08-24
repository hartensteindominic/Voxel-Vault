import PackBuilder from './PackBuilder';

export default async function PackSuccessPage({searchParams}:{searchParams:Promise<{session_id?:string}>}){
  const {session_id}=await searchParams;
  return <PackBuilder sessionId={session_id||''}/>;
}
