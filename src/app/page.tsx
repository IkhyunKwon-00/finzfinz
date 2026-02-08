'use client'; // 클라이언트 측에서 실행되는 코드임을 명시

import { useState } from 'react';

export default function Home() {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 🔐 나만 아는 비밀번호 설정 (원하는 것으로 바꾸세요!)
  const MY_SECRET = "0914"; 

  // 비밀번호 확인 함수
  const handleLogin = () => {
    if (password === MY_SECRET) {
      setIsAuthorized(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  // 1. 권한이 없을 때 보여줄 "비공개" 화면
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white shadow-lg rounded-2xl border border-gray-200 text-center">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">FinzFinz Restricted Area</h1>
          <p className="text-sm text-gray-500 mb-4">개발 중인 사이트입니다. 비밀번호를 입력하세요.</p>
          
          <input 
            type="password" 
            placeholder="비밀번호 입력"
            className="w-full border p-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()} // 엔터키 지원
          />
          
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // 2. 비밀번호 통과 시 보여줄 "진짜" 개발 화면
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-white">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-blue-600 mb-4">FinzFinz Admin Dashboard</h1>
        <p className="text-lg text-gray-600">성공적으로 접속하셨습니다. 이제 본격적으로 개발을 시작해볼까요?</p>
        
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 border rounded-xl hover:shadow-md transition-all">
            <h2 className="font-bold text-xl mb-2">📊 데이터 분석</h2>
            <p className="text-gray-500">FastAPI 모델 서버와 연결하여 예측치를 가져옵니다.</p>
          </div>
          <div className="p-6 border rounded-xl hover:shadow-md transition-all">
            <h2 className="font-bold text-xl mb-2">📰 뉴스 요약</h2>
            <p className="text-gray-500">실시간 크롤링된 뉴스를 AI가 요약합니다.</p>
          </div>
        </div>
      </div>
    </main>
  );
}