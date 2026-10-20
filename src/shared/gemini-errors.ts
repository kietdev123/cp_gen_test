type GeminiErrorBody = { code?: unknown; status?: unknown; message?: unknown };

function readError(error: unknown): { name: string; message: string; statusCode?: number; apiStatus?: string; detail?: string } {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const name = typeof value.name === 'string' ? value.name : '';
  const message = error instanceof Error ? error.message : typeof value.message === 'string' ? value.message : String(error);
  const directStatus = typeof value.status === 'number' ? value.status : undefined;
  const open = message.indexOf('{');
  const close = message.lastIndexOf('}');
  if (open >= 0 && close > open) {
    try {
      const parsed = JSON.parse(message.slice(open, close + 1)) as { error?: GeminiErrorBody } & GeminiErrorBody;
      const body = parsed.error && typeof parsed.error === 'object' ? parsed.error : parsed;
      return {
        name,
        message,
        statusCode: typeof body.code === 'number' ? body.code : directStatus,
        apiStatus: typeof body.status === 'string' ? body.status.toUpperCase() : undefined,
        detail: typeof body.message === 'string' ? body.message : undefined,
      };
    } catch { /* Fall back to the SDK error status/name. */ }
  }
  const statusMatch = message.match(/\b(400|401|402|403|404|408|409|429|499|500|501|503|504)\s+(INVALID_ARGUMENT|FAILED_PRECONDITION|UNAUTHENTICATED|PERMISSION_DENIED|NOT_FOUND|RESOURCE_EXHAUSTED|CANCELLED|INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED)?/i);
  return { name, message, statusCode: directStatus ?? (statusMatch ? Number(statusMatch[1]) : undefined), apiStatus: statusMatch?.[2]?.toUpperCase() };
}

export function friendlyGeminiApiError(error: unknown): string | null {
  const parsed = readError(error);
  const text = `${parsed.apiStatus ?? ''} ${parsed.detail ?? ''} ${parsed.message}`.toLowerCase();
  const status = parsed.apiStatus;

  if (/api key was reported as leaked|api key.*leak/.test(text)) {
    return 'Google đã vô hiệu hóa API key này vì lý do bảo mật. Hãy tạo key mới trong Google AI Studio rồi cập nhật tại Cài đặt → Trợ lý AI.';
  }
  if (/api[_ ]key[_ ]invalid|api key (is )?not valid|invalid api key/.test(text)) {
    return 'API key Gemini không hợp lệ. Hãy kiểm tra key trong Google AI Studio rồi nhập lại tại Cài đặt → Trợ lý AI.';
  }
  if (status === 'INVALID_ARGUMENT' || parsed.statusCode === 400) {
    return 'Gemini không chấp nhận yêu cầu này. Hãy kiểm tra model đang chọn trong Cài đặt → Trợ lý AI hoặc thử lại với nội dung ngắn hơn.';
  }
  if (status === 'FAILED_PRECONDITION') {
    return 'Tài khoản hoặc dự án Google chưa đáp ứng điều kiện để dùng Gemini. Hãy kiểm tra trạng thái dự án và thanh toán trong Google AI Studio.';
  }
  if (status === 'UNAUTHENTICATED' || parsed.statusCode === 401) {
    return 'API key Gemini không hợp lệ hoặc đã hết hạn. Hãy nhập lại key trong Cài đặt → Trợ lý AI.';
  }
  if (status === 'PERMISSION_DENIED' || parsed.statusCode === 403) {
    return 'API key hoặc dự án Google chưa có quyền dùng model này. Hãy kiểm tra quyền truy cập hoặc chọn model khác trong Cài đặt → Trợ lý AI.';
  }
  if (status === 'NOT_FOUND' || parsed.statusCode === 404) {
    return 'Không tìm thấy model Gemini đang chọn. Hãy kiểm tra tên model hoặc chọn model khác trong Cài đặt → Trợ lý AI.';
  }
  if (status === 'RESOURCE_EXHAUSTED' || parsed.statusCode === 429 || parsed.statusCode === 402) {
    return 'Gemini đang chạm giới hạn sử dụng. Hãy đợi quota làm mới hoặc kiểm tra hạn mức trong Google AI Studio.';
  }
  if (status === 'UNAVAILABLE' || parsed.statusCode === 503) {
    return 'Gemini đang quá tải tạm thời. Hãy thử lại sau ít phút hoặc đổi model trong Cài đặt → Trợ lý AI.';
  }
  if (status === 'INTERNAL' || parsed.statusCode === 500) {
    return 'Gemini vừa gặp lỗi khi xử lý yêu cầu. Hãy thử lại; nếu vẫn lỗi, rút ngắn nội dung hoặc chọn model khác.';
  }
  if (status === 'DEADLINE_EXCEEDED' || parsed.statusCode === 504 || parsed.statusCode === 408) {
    return 'Gemini mất quá nhiều thời gian để xử lý yêu cầu. Hãy thử lại với nội dung ngắn hơn hoặc chọn model nhanh hơn.';
  }
  if (status === 'SAFETY' || status === 'PROHIBITED_CONTENT' || status === 'CONTENT_BLOCKED' || status === 'SPII') {
    return 'Gemini không thể trả lời yêu cầu này do giới hạn an toàn nội dung. Hãy thử diễn đạt lại yêu cầu.';
  }
  if (/fetch failed|network error|enotfound|econnrefused|socket hang up/.test(text)) {
    return 'Không kết nối được tới Gemini. Hãy kiểm tra Internet hoặc thiết lập mạng rồi thử lại.';
  }
  if (parsed.name === 'ApiError' || /error invoking remote method ['"]ai:/.test(text)) {
    return 'Gemini chưa thể xử lý yêu cầu lúc này. Hãy thử lại sau hoặc chọn model khác trong Cài đặt → Trợ lý AI.';
  }
  return null;
}
