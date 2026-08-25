import { LegalLayout } from "../legal-layout";

export default function TermsPage() {
  return (
    <LegalLayout eyebrow="TERMS" title="이용약관 초안" intro="skillbase를 안전하게 이용하기 위한 기본 규칙입니다.">
      <section><h2>1. 서비스 범위</h2><p>skillbase는 공개 원본에 게시된 AI Skill의 설명, 출처, 설치 경로, 검증 상태를 정리해 제공하는 카탈로그입니다. 각 Skill의 품질·안전성·호환성을 무조건 보증하지 않으며, 사용자는 설치 전 원본과 권한을 직접 확인해야 합니다.</p></section>
      <section><h2>2. 원본과 라이선스</h2><p>Skill의 저작권과 라이선스는 각 원본 저장소·제작자에게 있습니다. skillbase의 요약·분류·검증 표시는 이용을 돕기 위한 편집 정보이며 원본 라이선스를 대체하지 않습니다.</p></section>
      <section><h2>3. 금지 행위</h2><p>허위 제출, 자동화된 과도한 호출, 다른 사용자의 권한 침해, 악성 명령·비밀정보·개인정보를 포함한 콘텐츠의 유포, 서비스 장애를 유발하는 행위를 금지합니다.</p></section>
      <section><h2>4. 검토와 공개 해제</h2><p>운영자는 깨진 원본 링크, 라이선스 변경, 중복, 위험 신호, 신고가 확인된 Skill을 검토 큐로 되돌리거나 공개 해제할 수 있습니다. 검증 완료 표시는 특정 환경에서의 실행을 보장하지 않습니다.</p></section>
      <section><h2>5. 변경과 책임</h2><p>서비스 기능과 약관은 운영상 필요에 따라 변경될 수 있습니다. 실제 공개 전 사업자 정보, 책임 제한, 분쟁 해결, 환불·유료 기능 조항을 별도로 확정해야 합니다.</p></section>
    </LegalLayout>
  );
}
