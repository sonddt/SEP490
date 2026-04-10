using System.ComponentModel.DataAnnotations;

namespace shuttleup.tests.unit.Dependencies;

internal static class ValidationTestHelper
{
    internal static List<ValidationResult> Validate(object model)
    {
        var context = new ValidationContext(model);
        var results = new List<ValidationResult>();

        Validator.TryValidateObject(
            model,
            context,
            results,
            validateAllProperties: true);

        return results;
    }
}
