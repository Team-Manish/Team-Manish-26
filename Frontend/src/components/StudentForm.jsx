import { useState, useEffect } from "react";

function StudentForm({ onSubmit, initialData = null, onCancel = null, isSubmitting = false }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        email: initialData.email || "",
        age: initialData.age || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        age: "",
      });
    }
  }, [initialData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      age: Number(formData.age),
    });
  };

  return (
    <form className="student-form" onSubmit={handleSubmit}>
      <h3>{initialData ? "Edit Student Record" : "Add New Student"}</h3>
      
      <div className="form-field">
        <label htmlFor="student-name">Full Name</label>
        <input
          id="student-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. John Doe"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="form-field">
        <label htmlFor="student-email">Email Address</label>
        <input
          id="student-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="e.g. john@example.com"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="form-field">
        <label htmlFor="student-age">Age</label>
        <input
          id="student-age"
          type="number"
          name="age"
          min="1"
          max="120"
          value={formData.age}
          onChange={handleChange}
          placeholder="e.g. 21"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialData ? "Update Student" : "Add Student"}
        </button>
        {initialData && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default StudentForm;