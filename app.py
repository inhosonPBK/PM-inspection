"""
PM 일상점검 웹 시스템
- 작업자별 PM 점검 기록 입력
- 날짜별/작업자별/월별 조회 및 PDF 출력
"""

import streamlit as st
import sqlite3
from datetime import datetime, date
import pandas as pd
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ============ 점검 항목 정의 ============
INSPECTION_ITEMS = [
    {
        "id": "esd_shoes",
        "name": "제전화 (ESD Shoes)",
        "method": "제전화 착용 후 제전화 테스터기 Both 버튼 누르고 올라서서 손바닥 접촉",
        "pass_spec": "10⁵Ω ~ 10⁸Ω",
        "db_column": "esd_test",
        "video_url": ""  # Deep How 딥링크 입력
    },
    {
        "id": "wrist_strap",
        "name": "어스링 (Wrist Strap)",
        "method": "어스링 착용 후 테스터기 Wrist 버튼 누르고 올라서서 손바닥 접촉",
        "pass_spec": "10⁵Ω ~ 10⁸Ω",
        "db_column": "earth_ring_test",
        "video_url": ""  # Deep How 딥링크 입력
    },
    {
        "id": "workstation",
        "name": "작업대 (ESD Workstation)",
        "method": "Check A: GND Connection 확인\nCheck B: Wrist strap & mat ground wire 연결 확인",
        "pass_spec": "1Ω ~ 1GΩ",
        "db_column": "workbench_insulation_test",
        "video_url": ""  # Deep How 딥링크 입력
    },
]

# ============ 데이터베이스 설정 ============
DB_PATH = "pm_inspection.db"

def init_db():
    """데이터베이스 초기화"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 작업자 테이블
    c.execute('''
        CREATE TABLE IF NOT EXISTS workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            employee_id TEXT UNIQUE
        )
    ''')
    
    # PM 점검 기록 테이블
    c.execute('''
        CREATE TABLE IF NOT EXISTS pm_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id INTEGER NOT NULL,
            inspection_date DATE NOT NULL,
            esd_test TEXT NOT NULL,
            earth_ring_test TEXT NOT NULL,
            workbench_insulation_test TEXT NOT NULL,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (worker_id) REFERENCES workers(id),
            UNIQUE(worker_id, inspection_date)
        )
    ''')
    
    # 실제 작업자 5명
    default_workers = [
        ("김은기", "EMP001"),
        ("김성연", "EMP002"),
        ("김환수", "EMP003"),
        ("김동근", "EMP004"),
        ("김희재", "EMP005"),
    ]
    
    for name, emp_id in default_workers:
        try:
            c.execute("INSERT OR IGNORE INTO workers (name, employee_id) VALUES (?, ?)", 
                     (name, emp_id))
        except:
            pass
    
    conn.commit()
    conn.close()

def get_workers():
    """작업자 목록 조회"""
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT * FROM workers ORDER BY name", conn)
    conn.close()
    return df

def save_pm_record(worker_id, inspection_date, esd_test, earth_ring_test, 
                   workbench_test, remarks=""):
    """PM 점검 기록 저장"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT OR REPLACE INTO pm_records 
            (worker_id, inspection_date, esd_test, earth_ring_test, 
             workbench_insulation_test, remarks, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (worker_id, inspection_date, esd_test, earth_ring_test, 
              workbench_test, remarks, datetime.now()))
        conn.commit()
        success = True
    except Exception as e:
        st.error(f"저장 오류: {e}")
        success = False
    finally:
        conn.close()
    
    return success

def get_records_by_date(inspection_date):
    """특정 날짜의 모든 기록 조회"""
    conn = sqlite3.connect(DB_PATH)
    query = '''
        SELECT w.name, w.employee_id, p.esd_test, p.earth_ring_test, 
               p.workbench_insulation_test, p.remarks, p.created_at
        FROM pm_records p
        JOIN workers w ON p.worker_id = w.id
        WHERE p.inspection_date = ?
        ORDER BY w.name
    '''
    df = pd.read_sql_query(query, conn, params=[inspection_date])
    conn.close()
    return df

def get_records_by_worker_and_month(worker_id, year, month):
    """특정 작업자의 월별 기록 조회"""
    conn = sqlite3.connect(DB_PATH)
    query = '''
        SELECT p.inspection_date, p.esd_test, p.earth_ring_test, 
               p.workbench_insulation_test, p.remarks
        FROM pm_records p
        WHERE p.worker_id = ? 
          AND strftime('%Y', p.inspection_date) = ?
          AND strftime('%m', p.inspection_date) = ?
        ORDER BY p.inspection_date
    '''
    df = pd.read_sql_query(query, conn, params=[worker_id, str(year), f"{month:02d}"])
    conn.close()
    return df

def get_records_by_month(year, month):
    """월별 전체 기록 조회"""
    conn = sqlite3.connect(DB_PATH)
    query = '''
        SELECT p.inspection_date, w.name, w.employee_id, p.esd_test, 
               p.earth_ring_test, p.workbench_insulation_test, p.remarks
        FROM pm_records p
        JOIN workers w ON p.worker_id = w.id
        WHERE strftime('%Y', p.inspection_date) = ?
          AND strftime('%m', p.inspection_date) = ?
        ORDER BY p.inspection_date, w.name
    '''
    df = pd.read_sql_query(query, conn, params=[str(year), f"{month:02d}"])
    conn.close()
    return df

# ============ PDF 생성 ============
def create_daily_report_pdf(inspection_date, records_df):
    """일별 점검 보고서 PDF 생성"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                           topMargin=20*mm, bottomMargin=20*mm,
                           leftMargin=15*mm, rightMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=16,
        spaceAfter=20
    )
    
    elements = []
    
    # 제목
    title = Paragraph(f"PM Daily Inspection Report - {inspection_date}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 10*mm))
    
    if records_df.empty:
        elements.append(Paragraph("No records found for this date.", styles['Normal']))
    else:
        # 테이블 데이터 준비
        table_data = [
            ['Name', 'ID', 'ESD Test', 'Earth Ring', 'Workbench', 'Remarks']
        ]
        
        for _, row in records_df.iterrows():
            table_data.append([
                row['name'],
                row['employee_id'] or '-',
                row['esd_test'],
                row['earth_ring_test'],
                row['workbench_insulation_test'],
                row['remarks'] or '-'
            ])
        
        # 테이블 생성
        table = Table(table_data, colWidths=[35*mm, 25*mm, 25*mm, 25*mm, 25*mm, 35*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        
        elements.append(table)
    
    # 푸터 정보
    elements.append(Spacer(1, 20*mm))
    footer_text = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    elements.append(Paragraph(footer_text, styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

def create_monthly_report_pdf(year, month, records_df, worker_name=None):
    """월별 점검 보고서 PDF 생성"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                           topMargin=20*mm, bottomMargin=20*mm,
                           leftMargin=15*mm, rightMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=16,
        spaceAfter=20
    )
    
    elements = []
    
    # 제목
    if worker_name:
        title_text = f"PM Monthly Report - {year}/{month:02d} - {worker_name}"
    else:
        title_text = f"PM Monthly Report - {year}/{month:02d} (All Workers)"
    
    title = Paragraph(title_text, title_style)
    elements.append(title)
    elements.append(Spacer(1, 10*mm))
    
    if records_df.empty:
        elements.append(Paragraph("No records found for this period.", styles['Normal']))
    else:
        # 테이블 데이터 준비
        if worker_name:
            # 개인별 월간 보고서
            table_data = [['Date', 'ESD Test', 'Earth Ring', 'Workbench', 'Remarks']]
            for _, row in records_df.iterrows():
                table_data.append([
                    row['inspection_date'],
                    row['esd_test'],
                    row['earth_ring_test'],
                    row['workbench_insulation_test'],
                    row['remarks'] or '-'
                ])
            col_widths = [30*mm, 30*mm, 30*mm, 30*mm, 40*mm]
        else:
            # 전체 월간 보고서
            table_data = [['Date', 'Name', 'ESD', 'Earth Ring', 'Workbench', 'Remarks']]
            for _, row in records_df.iterrows():
                table_data.append([
                    row['inspection_date'],
                    row['name'],
                    row['esd_test'],
                    row['earth_ring_test'],
                    row['workbench_insulation_test'],
                    row['remarks'] or '-'
                ])
            col_widths = [25*mm, 30*mm, 25*mm, 25*mm, 25*mm, 35*mm]
        
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        
        elements.append(table)
        
        # 통계 요약
        elements.append(Spacer(1, 10*mm))
        total_records = len(records_df)
        pass_count = len(records_df[
            (records_df['esd_test'] == 'Pass') & 
            (records_df['earth_ring_test'] == 'Pass') & 
            (records_df['workbench_insulation_test'] == 'Pass')
        ])
        
        summary = f"Total Records: {total_records} | All Pass: {pass_count} | Issues: {total_records - pass_count}"
        elements.append(Paragraph(summary, styles['Normal']))
    
    # 푸터
    elements.append(Spacer(1, 15*mm))
    footer_text = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    elements.append(Paragraph(footer_text, styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

# ============ Streamlit UI ============
def main():
    st.set_page_config(
        page_title="PM Inspection System",
        page_icon="🔧",
        layout="wide"
    )
    
    # 데이터베이스 초기화
    init_db()
    
    # 사이드바 스타일
    st.sidebar.markdown("""
    <div style="text-align: center; padding: 10px;">
        <h2 style="color: #1f77b4;">🔧 PM Inspection</h2>
        <p style="color: #666; font-size: 0.9em;">Daily Check System</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.sidebar.markdown("---")
    
    # 작업자 현황 표시
    workers_df = get_workers()
    st.sidebar.markdown("**👥 작업자 현황**")
    
    # 오늘 점검 완료 현황
    today_records = get_records_by_date(date.today())
    completed_workers = today_records['name'].tolist() if not today_records.empty else []
    
    for _, worker in workers_df.iterrows():
        if worker['name'] in completed_workers:
            st.sidebar.markdown(f"✅ {worker['name']}")
        else:
            st.sidebar.markdown(f"⬜ {worker['name']}")
    
    st.sidebar.markdown("---")
    
    # 메뉴
    menu = st.sidebar.radio(
        "메뉴",
        ["📝 점검 입력", "📊 일자별 조회", "👤 작업자별 조회", "📅 월간 보고서", "⚙️ 설정"],
        label_visibility="collapsed"
    )
    
    if menu == "📝 점검 입력":
        record_inspection_page()
    elif menu == "📊 일자별 조회":
        view_by_date_page()
    elif menu == "👤 작업자별 조회":
        view_by_worker_page()
    elif menu == "📅 월간 보고서":
        monthly_report_page()
    elif menu == "⚙️ 설정":
        settings_page()

def record_inspection_page():
    """점검 기록 입력 페이지 - 세로형 체크리스트"""
    st.header("📝 PM Daily Inspection")
    
    # 상단: 날짜 및 작업자 선택
    col1, col2, col3 = st.columns([1, 1, 2])
    
    with col1:
        inspection_date = st.date_input(
            "📅 점검일자",
            value=date.today(),
            format="YYYY-MM-DD"
        )
    
    workers_df = get_workers()
    
    with col2:
        worker_options = {row['name']: row['id'] for _, row in workers_df.iterrows()}
        selected_worker = st.selectbox("👤 작업자", list(worker_options.keys()))
        worker_id = worker_options[selected_worker]
    
    st.markdown("---")
    
    # 점검 항목 테이블 형태로 표시
    st.subheader("🔍 점검 항목")
    
    # CSS로 테이블 스타일링
    st.markdown("""
    <style>
    .inspection-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
    }
    .inspection-header {
        background-color: #1f77b4;
        color: white;
        padding: 12px;
        text-align: left;
        font-weight: bold;
    }
    .inspection-cell {
        padding: 15px;
        border-bottom: 1px solid #ddd;
        vertical-align: top;
    }
    .spec-box {
        background-color: #f0f7ff;
        border-left: 3px solid #1f77b4;
        padding: 8px 12px;
        margin: 5px 0;
        border-radius: 0 4px 4px 0;
    }
    .method-text {
        color: #555;
        font-size: 0.9em;
        line-height: 1.5;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # 점검 결과 저장용 딕셔너리
    results = {}
    
    # 각 점검 항목을 세로로 표시
    for item in INSPECTION_ITEMS:
        with st.container():
            # 항목 헤더 (이름 + 영상 아이콘)
            header_col1, header_col2 = st.columns([6, 1])
            
            with header_col1:
                st.markdown(f"""
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 5px; border: 1px solid #e0e0e0;">
                    <h4 style="margin: 0; color: #1f77b4;">{item['name']}</h4>
                </div>
                """, unsafe_allow_html=True)
            
            with header_col2:
                # 영상 링크 아이콘
                if item.get('video_url') and item['video_url'].strip():
                    st.markdown(f"""
                    <a href="{item['video_url']}" target="_blank" style="text-decoration: none;">
                        <div style="background-color: #ff6b6b; border-radius: 8px; padding: 15px; margin-bottom: 5px; text-align: center; cursor: pointer;">
                            <span style="font-size: 1.5em;">🎬</span>
                        </div>
                    </a>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                    <div style="background-color: #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 5px; text-align: center;" title="영상 미등록">
                        <span style="font-size: 1.5em; opacity: 0.4;">🎬</span>
                    </div>
                    """, unsafe_allow_html=True)
            
            col_info, col_check = st.columns([3, 1])
            
            with col_info:
                # 측정 방법
                st.markdown(f"**📋 측정 방법**")
                st.markdown(f"<div class='method-text'>{item['method'].replace(chr(10), '<br>')}</div>", 
                           unsafe_allow_html=True)
                
                # Pass Spec
                st.markdown(f"""
                <div class='spec-box'>
                    <strong>✅ Pass Spec:</strong> {item['pass_spec']}
                </div>
                """, unsafe_allow_html=True)
            
            with col_check:
                # 체크 버튼
                st.markdown("<br>", unsafe_allow_html=True)
                result = st.radio(
                    "Result",
                    ["Pass", "Fail"],
                    key=f"check_{item['id']}",
                    horizontal=False,
                    label_visibility="collapsed"
                )
                results[item['db_column']] = result
                
                # 결과에 따른 시각적 피드백
                if result == "Pass":
                    st.success("✅ Pass")
                else:
                    st.error("❌ Fail")
            
            st.markdown("<hr style='margin: 5px 0; border: none; border-top: 1px solid #eee;'>", 
                       unsafe_allow_html=True)
    
    # 비고란
    remarks = st.text_area("📝 비고 (Remarks)", height=60, placeholder="특이사항이 있으면 입력하세요...")
    
    st.markdown("---")
    
    # 제출 버튼
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("✅ 점검 완료 (Submit)", type="primary", use_container_width=True):
            if save_pm_record(
                worker_id, 
                inspection_date, 
                results['esd_test'], 
                results['earth_ring_test'], 
                results['workbench_insulation_test'], 
                remarks
            ):
                st.success(f"✅ {selected_worker}님의 {inspection_date} 점검 기록이 저장되었습니다!")
                st.balloons()
            else:
                st.error("저장 실패 - 다시 시도해주세요")

def view_by_date_page():
    """일자별 조회 페이지"""
    st.header("📊 일자별 점검 현황")
    
    selected_date = st.date_input(
        "조회 일자",
        value=date.today(),
        format="YYYY-MM-DD"
    )
    
    records_df = get_records_by_date(selected_date)
    
    if records_df.empty:
        st.info(f"📭 {selected_date} 에 기록된 점검 내역이 없습니다.")
    else:
        st.subheader(f"📋 {selected_date} 점검 현황")
        
        # 완료 현황 요약
        workers_df = get_workers()
        total_workers = len(workers_df)
        completed = len(records_df)
        
        col1, col2, col3 = st.columns(3)
        col1.metric("전체 작업자", f"{total_workers}명")
        col2.metric("점검 완료", f"{completed}명")
        col3.metric("미완료", f"{total_workers - completed}명")
        
        st.markdown("---")
        
        # 결과 표시
        display_df = records_df.copy()
        display_df.columns = ['작업자', '사번', '제전화', '어스링', '작업대', '비고', '기록시간']
        
        # Pass/Fail 색상 표시
        def highlight_result(val):
            if val == 'Pass':
                return 'background-color: #90EE90'
            elif val == 'Fail':
                return 'background-color: #FFB6C1'
            return ''
        
        styled_df = display_df.style.applymap(
            highlight_result, 
            subset=['제전화', '어스링', '작업대']
        )
        st.dataframe(styled_df, use_container_width=True)
        
        # PDF 다운로드
        st.markdown("---")
        pdf_buffer = create_daily_report_pdf(selected_date, records_df)
        st.download_button(
            label="📄 PDF 다운로드",
            data=pdf_buffer,
            file_name=f"PM_Daily_{selected_date}.pdf",
            mime="application/pdf"
        )

def view_by_worker_page():
    """작업자별 조회 페이지"""
    st.header("👤 작업자별 점검 이력")
    
    workers_df = get_workers()
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        worker_options = {row['name']: (row['id'], row['name'])
                        for _, row in workers_df.iterrows()}
        selected_worker = st.selectbox("작업자 선택", list(worker_options.keys()))
        worker_id, worker_name = worker_options[selected_worker]
    
    with col2:
        year = st.selectbox("연도", range(2024, 2030), index=1)
    
    with col3:
        month = st.selectbox("월", range(1, 13), index=datetime.now().month - 1)
    
    records_df = get_records_by_worker_and_month(worker_id, year, month)
    
    if records_df.empty:
        st.info(f"📭 {worker_name}님의 {year}년 {month}월 기록이 없습니다.")
    else:
        st.subheader(f"📋 {worker_name} - {year}년 {month}월")
        
        # 통계
        total = len(records_df)
        all_pass = len(records_df[
            (records_df['esd_test'] == 'Pass') & 
            (records_df['earth_ring_test'] == 'Pass') & 
            (records_df['workbench_insulation_test'] == 'Pass')
        ])
        
        col1, col2 = st.columns(2)
        col1.metric("점검 횟수", f"{total}회")
        col2.metric("전체 Pass", f"{all_pass}회 ({all_pass/total*100:.0f}%)" if total > 0 else "0회")
        
        st.markdown("---")
        
        display_df = records_df.copy()
        display_df.columns = ['일자', '제전화', '어스링', '작업대', '비고']
        
        def highlight_result(val):
            if val == 'Pass':
                return 'background-color: #90EE90'
            elif val == 'Fail':
                return 'background-color: #FFB6C1'
            return ''
        
        styled_df = display_df.style.applymap(
            highlight_result,
            subset=['제전화', '어스링', '작업대']
        )
        st.dataframe(styled_df, use_container_width=True)
        
        # PDF 다운로드
        st.markdown("---")
        pdf_buffer = create_monthly_report_pdf(year, month, records_df, worker_name)
        st.download_button(
            label="📄 PDF 다운로드",
            data=pdf_buffer,
            file_name=f"PM_{worker_name}_{year}{month:02d}.pdf",
            mime="application/pdf"
        )

def monthly_report_page():
    """월별 전체 보고서 페이지"""
    st.header("📅 월간 종합 보고서")
    
    col1, col2 = st.columns(2)
    
    with col1:
        year = st.selectbox("연도", range(2024, 2030), index=1, key="monthly_year")
    
    with col2:
        month = st.selectbox("월", range(1, 13), index=datetime.now().month - 1, key="monthly_month")
    
    records_df = get_records_by_month(year, month)
    
    if records_df.empty:
        st.info(f"📭 {year}년 {month}월 기록이 없습니다.")
    else:
        st.subheader(f"📋 {year}년 {month}월 종합 현황")
        
        # 요약 통계
        col1, col2, col3, col4 = st.columns(4)
        
        total_records = len(records_df)
        all_pass = len(records_df[
            (records_df['esd_test'] == 'Pass') & 
            (records_df['earth_ring_test'] == 'Pass') & 
            (records_df['workbench_insulation_test'] == 'Pass')
        ])
        unique_dates = records_df['inspection_date'].nunique()
        unique_workers = records_df['name'].nunique()
        
        col1.metric("총 점검 건수", f"{total_records}건")
        col2.metric("전체 Pass", f"{all_pass}건")
        col3.metric("점검 일수", f"{unique_dates}일")
        col4.metric("참여 작업자", f"{unique_workers}명")
        
        st.markdown("---")
        
        display_df = records_df.copy()
        display_df.columns = ['일자', '작업자', '사번', '제전화', '어스링', '작업대', '비고']
        
        def highlight_result(val):
            if val == 'Pass':
                return 'background-color: #90EE90'
            elif val == 'Fail':
                return 'background-color: #FFB6C1'
            return ''
        
        styled_df = display_df.style.applymap(
            highlight_result,
            subset=['제전화', '어스링', '작업대']
        )
        st.dataframe(styled_df, use_container_width=True)
        
        # PDF 다운로드
        st.markdown("---")
        pdf_buffer = create_monthly_report_pdf(year, month, records_df)
        st.download_button(
            label="📄 월간 보고서 PDF 다운로드",
            data=pdf_buffer,
            file_name=f"PM_Monthly_{year}{month:02d}.pdf",
            mime="application/pdf"
        )

def settings_page():
    """설정 페이지"""
    st.header("⚙️ 설정")
    
    st.subheader("👥 작업자 관리")
    
    workers_df = get_workers()
    
    # 작업자 목록을 카드 형태로 표시
    cols = st.columns(5)
    for idx, (_, worker) in enumerate(workers_df.iterrows()):
        with cols[idx % 5]:
            st.markdown(f"""
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; margin: 5px;">
                <div style="font-size: 2em;">👤</div>
                <div style="font-weight: bold;">{worker['name']}</div>
                <div style="color: #666; font-size: 0.9em;">{worker['employee_id']}</div>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("---")
    st.subheader("➕ 작업자 추가")
    
    col1, col2, col3 = st.columns([2, 2, 1])
    with col1:
        new_name = st.text_input("이름")
    with col2:
        new_emp_id = st.text_input("사번")
    with col3:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("추가", use_container_width=True):
            if new_name:
                conn = sqlite3.connect(DB_PATH)
                c = conn.cursor()
                try:
                    c.execute("INSERT INTO workers (name, employee_id) VALUES (?, ?)",
                             (new_name, new_emp_id))
                    conn.commit()
                    st.success(f"✅ {new_name}님이 추가되었습니다.")
                    st.rerun()
                except sqlite3.IntegrityError:
                    st.error("이미 등록된 이름 또는 사번입니다.")
                finally:
                    conn.close()
            else:
                st.warning("이름을 입력해주세요.")
    
    st.markdown("---")
    st.subheader("📋 점검 항목 안내")
    
    for item in INSPECTION_ITEMS:
        with st.expander(f"**{item['name']}**"):
            st.markdown(f"**측정 방법:** {item['method']}")
            st.markdown(f"**Pass Spec:** `{item['pass_spec']}`")

if __name__ == "__main__":
    main()