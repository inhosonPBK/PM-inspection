/**
 * =====================================================
 * PBK PM Inspection - Google Apps Script 추가 코드
 * =====================================================
 *
 * [설치 방법]
 * 1. 구글 시트 (https://docs.google.com/spreadsheets/d/1mulDsJrik7hLIGpy1vyhjExKC7kX7AEiPiGMDL05qUg)를 열기
 * 2. 확장 프로그램 → Apps Script 클릭
 * 3. 기존 doGet 함수 안에 아래 case들을 추가
 * 4. 별도 함수들(handleXxx)을 기존 코드 아래에 붙여넣기
 * 5. 배포 → 새 배포 → 웹 앱 → 액세스: 모든 사용자 → 배포
 *
 * [구글 시트에 'Users' 시트 추가]
 * 시트 이름: Users
 * 열 구조 (A~G):
 *   A: username   B: password_hash   C: name   D: email
 *   E: status (pending/approved/rejected)   F: created_at   G: approved_at
 * =====================================================
 */

// ── doGet 함수 내부의 switch(action) 에 아래 case 추가 ──────────────────────

/*
function doGet(e) {
  var params = e.parameter;
  var action = params.action || '';
  var callback = params.callback || 'callback';

  var result;
  switch(action) {
    // ... 기존 case들 ...

    case 'login_user':
      result = handleLoginUser(params);
      break;
    case 'register_user':
      result = handleRegisterUser(params);
      break;
    case 'approve_user':
      result = handleApproveUser(params);
      break;
    case 'get_users':
      result = handleGetUsers(params);
      break;

    // ... 기존 default ...
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
*/

// ── 아래 함수들을 GAS 파일에 추가 ───────────────────────────────────────────

var ADMIN_NOTIFICATION_EMAIL = 'Inho.son@promega.com';

/**
 * 로그인 처리
 * params: username, password_hash
 */
function handleLoginUser(params) {
  try {
    var username = (params.username || '').trim().toLowerCase();
    var passwordHash = (params.password_hash || '').trim();

    if (!username || !passwordHash) {
      return { success: false, error: '아이디와 비밀번호를 입력해주세요.' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      return { success: false, error: 'Users 시트가 존재하지 않습니다. 관리자에게 문의하세요.' };
    }

    var data = sheet.getDataRange().getValues();
    // 헤더 제외하고 검색
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowUsername = String(row[0] || '').trim().toLowerCase();
      var rowHash = String(row[1] || '').trim();
      var rowName = String(row[2] || '');
      var rowEmail = String(row[3] || '');
      var rowStatus = String(row[4] || '').trim();

      if (rowUsername === username) {
        if (rowHash !== passwordHash) {
          return { success: false, error: '비밀번호가 올바르지 않습니다.' };
        }
        if (rowStatus === 'pending') {
          return { success: false, error: '가입 신청이 승인 대기 중입니다. 관리자 승인 후 로그인이 가능합니다.' };
        }
        if (rowStatus === 'rejected') {
          return { success: false, error: '가입 신청이 거절되었습니다. 관리자에게 문의하세요.' };
        }
        if (rowStatus !== 'approved') {
          return { success: false, error: '계정 상태를 확인해주세요. 관리자에게 문의하세요.' };
        }

        // 로그인 성공
        var isAdmin = rowEmail.toLowerCase() === ADMIN_NOTIFICATION_EMAIL.toLowerCase();
        return {
          success: true,
          user: {
            username: rowUsername,
            name: rowName,
            email: rowEmail,
            role: isAdmin ? 'admin' : 'user'
          }
        };
      }
    }

    return { success: false, error: '존재하지 않는 아이디입니다.' };
  } catch(e) {
    return { success: false, error: 'Server error: ' + e.message };
  }
}

/**
 * 회원가입 신청 처리
 * params: username, password_hash, name, email, admin_email
 */
function handleRegisterUser(params) {
  try {
    var username = (params.username || '').trim().toLowerCase();
    var passwordHash = (params.password_hash || '').trim();
    var name = (params.name || '').trim();
    var email = (params.email || '').trim();

    if (!username || !passwordHash || !name || !email) {
      return { success: false, error: '모든 항목을 입력해주세요.' };
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return { success: false, error: '아이디는 영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다.' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');

    // Users 시트 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet('Users');
      sheet.appendRow(['username', 'password_hash', 'name', 'email', 'status', 'created_at', 'approved_at']);
    }

    var data = sheet.getDataRange().getValues();
    // 중복 아이디 체크
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === username) {
        return { success: false, error: '이미 사용 중인 아이디입니다.' };
      }
    }

    var now = new Date().toISOString();
    sheet.appendRow([username, passwordHash, name, email, 'pending', now, '']);

    // 관리자에게 승인 요청 이메일 발송
    try {
      var approveUrl = ScriptApp.getService().getUrl()
        + '?action=approve_user&username=' + encodeURIComponent(username) + '&action_type=approve';
      var rejectUrl = ScriptApp.getService().getUrl()
        + '?action=approve_user&username=' + encodeURIComponent(username) + '&action_type=reject';

      var subject = '[PBK PM Inspection] 회원가입 승인 요청: ' + name + ' (' + username + ')';
      var body = '안녕하세요,\n\n'
        + 'PBK PM Inspection 시스템에 새로운 가입 신청이 있습니다.\n\n'
        + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        + '이름: ' + name + '\n'
        + '아이디: ' + username + '\n'
        + '이메일: ' + email + '\n'
        + '신청일시: ' + now + '\n'
        + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        + '아래 링크를 클릭하여 처리해주세요:\n\n'
        + '✅ 승인: ' + approveUrl + '\n\n'
        + '❌ 거절: ' + rejectUrl + '\n\n'
        + '또는 대시보드 [설정 > 사용자 관리]에서 직접 처리하실 수 있습니다.\n\n'
        + '감사합니다.';

      MailApp.sendEmail(ADMIN_NOTIFICATION_EMAIL, subject, body);
    } catch(mailErr) {
      // 이메일 발송 실패해도 가입 신청 자체는 성공
      Logger.log('이메일 발송 실패: ' + mailErr.message);
    }

    return { success: true, message: '가입 신청이 완료되었습니다.' };
  } catch(e) {
    return { success: false, error: 'Server error: ' + e.message };
  }
}

/**
 * 사용자 승인/거절/취소 처리
 * params: username, action_type (approve|reject|revoke)
 */
function handleApproveUser(params) {
  try {
    var username = (params.username || '').trim().toLowerCase();
    var actionType = (params.action_type || '').trim(); // approve, reject, revoke

    if (!username) {
      return { success: false, error: '아이디가 필요합니다.' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      return { success: false, error: 'Users 시트가 없습니다.' };
    }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === username) {
        var newStatus = '';
        if (actionType === 'approve') {
          newStatus = 'approved';
          sheet.getRange(i + 1, 7).setValue(new Date().toISOString()); // approved_at

          // 사용자에게 승인 완료 이메일 발송
          try {
            var userEmail = String(data[i][3] || '');
            var userName = String(data[i][2] || '');
            if (userEmail) {
              MailApp.sendEmail(
                userEmail,
                '[PBK PM Inspection] 가입 승인 완료',
                '안녕하세요 ' + userName + '님,\n\nPBK PM Inspection 가입이 승인되었습니다.\n이제 로그인하여 사용하실 수 있습니다.\n\n감사합니다.'
              );
            }
          } catch(e) {}

        } else if (actionType === 'reject') {
          newStatus = 'rejected';
        } else if (actionType === 'revoke') {
          newStatus = 'pending';
          sheet.getRange(i + 1, 7).setValue(''); // approved_at 초기화
        } else {
          return { success: false, error: '올바르지 않은 action_type입니다.' };
        }

        sheet.getRange(i + 1, 5).setValue(newStatus); // status 업데이트

        // 브라우저에서 직접 링크로 접근한 경우 HTML 응답 반환
        return { success: true, message: '처리 완료 (' + actionType + '): ' + username };
      }
    }

    return { success: false, error: '해당 사용자를 찾을 수 없습니다.' };
  } catch(e) {
    return { success: false, error: 'Server error: ' + e.message };
  }
}

/**
 * 사용자 목록 조회 (관리자용)
 * params: (없음)
 */
function handleGetUsers(params) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      return { success: true, users: [] };
    }

    var data = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // 빈 행 스킵
      users.push({
        username: String(row[0] || ''),
        name: String(row[2] || ''),
        email: String(row[3] || ''),
        status: String(row[4] || ''),
        created_at: String(row[5] || ''),
        approved_at: String(row[6] || '')
      });
    }

    return { success: true, users: users };
  } catch(e) {
    return { success: false, error: 'Server error: ' + e.message };
  }
}
