function StudentCard({ student, onEdit, onDelete, isDeleting = false }) {
  return (
    <div className="student-card">
      <div className="student-card-header">
        <h3>{student.name}</h3>
      </div>
      <div className="student-card-body">
        <p>
          <strong>Email:</strong> {student.email}
        </p>
        <p>
          <strong>Age:</strong> {student.age}
        </p>
      </div>
      <div className="student-card-actions">
        <button
          type="button"
          className="btn-edit"
          onClick={() => onEdit(student)}
          aria-label={`Edit ${student.name}`}
          disabled={isDeleting}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn-delete"
          onClick={() => onDelete(student._id)}
          aria-label={`Delete ${student.name}`}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default StudentCard;