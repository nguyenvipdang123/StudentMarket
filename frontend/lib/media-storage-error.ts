export class MediaStorageError extends Error {
  status: number;
  constructor(status: number, message = "Không kết nối được kho ảnh. Vui lòng thử lại sau.") { super(message); this.status = status; }
}
