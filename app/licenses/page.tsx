import { LegalLayout } from "../legal-layout";

export default function LicensesPage() {
  return (
    <LegalLayout eyebrow="LICENSES" title="원본·라이선스 안내" intro="카탈로그에 등록된 Skill은 원본의 라이선스와 배포 조건을 따릅니다.">
      <section><h2>Skill 원본</h2><p>각 상세 페이지에 표시되는 출처 링크와 라이선스 정보가 우선합니다. 라이선스가 미상인 항목은 사용 전 원본 저장소의 LICENSE, README, 배포 조건을 직접 확인하세요.</p></section>
      <section><h2>카탈로그 편집 정보</h2><p>skillbase가 작성한 한국어 요약, 카테고리, 위험 신호, 검증 결과는 카탈로그 운영을 위한 편집 데이터입니다. 원본 Skill 자체의 일부로 재배포되는 것이 아니며, 원본 라이선스에 따라 별도 이용 조건이 적용될 수 있습니다.</p></section>
      <section><h2>변경 감지</h2><p>자동 수집 과정에서 라이선스 변경이 감지되면 이전 값과 새 값을 보존하고 운영자 검토 알림을 생성합니다. 변경 감지 전 기간의 이용·배포 책임은 원본의 공지와 라이선스에 따라 판단해야 합니다.</p></section>
      <section><h2>오류 신고</h2><p>라이선스가 잘못 표시되었거나 원본 링크가 변경된 경우 해당 Skill의 문제 신고 기능으로 알려 주세요. 운영자는 원본 증거를 확인한 뒤 카탈로그 정보를 수정하거나 공개를 보류합니다.</p></section>
    </LegalLayout>
  );
}
