export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="p-8 bg-white shadow-xl rounded-2xl border border-gray-200 w-full max-w-md">
          <h1 className="text-3xl font-extrabold text-blue-600 mb-4">FinzFinz</h1>
          <p className="text-gray-600 mb-6 font-sans">
            AI 기반 주식 뉴스 요약 및 예측 플랫폼에 오신 것을 환영합니다.
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="font-bold text-blue-800">도메인 연결 상태:</span> 
              <span className="ml-2 text-green-600 font-bold">성공 (예정)</span>
            </div>
            <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
              분석 시작하기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}